from __future__ import annotations

import asyncio
import hmac
import os
import tempfile
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx
from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, status

from .edubook import build_edubook
from .inspection import (
    ArchiveResult,
    InspectionError,
    clamav_scan,
    detect_mime,
    download_source,
    inspect_archive,
)
from .models import ProcessRequest, WorkerCallback
from .preview import PreviewError, make_previews


app = FastAPI(
    title="EdNotebook Document Security Worker",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

ACTIVE_JOBS: set[str] = set()
ACTIVE_LOCK = asyncio.Lock()
WORKER_LIMIT = asyncio.Semaphore(max(1, int(os.getenv("MAX_CONCURRENT_JOBS", "1"))))


def _expected_worker_token() -> str:
    token = os.getenv("WORKER_API_TOKEN", "")
    if len(token) < 24:
        raise RuntimeError("WORKER_API_TOKEN must be configured with at least 24 characters")
    return token


async def require_worker(authorization: str | None = Header(default=None)) -> None:
    expected = _expected_worker_token()
    supplied = ""
    if authorization and authorization.lower().startswith("bearer "):
        supplied = authorization[7:].strip()
    if not supplied or not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Worker token is invalid")


def _callback_host_allowed(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    configured = {
        item.strip().lower()
        for item in os.getenv("ALLOWED_CALLBACK_HOSTS", "").split(",")
        if item.strip()
    }
    project_ref = os.getenv("SUPABASE_PROJECT_REF", "").strip().lower()
    if project_ref:
        configured.update({f"{project_ref}.supabase.co", f"{project_ref}.functions.supabase.co"})
    return bool(configured and host in configured and urlparse(url).scheme == "https")


BLOCKED_TOP_LEVEL_SUFFIXES = {
    ".ade", ".adp", ".apk", ".app", ".bat", ".bin", ".cab", ".chm", ".cmd",
    ".com", ".cpl", ".dll", ".dmg", ".exe", ".gadget", ".hta", ".img", ".inf",
    ".ins", ".iso", ".jar", ".js", ".jse", ".lnk", ".msc", ".msi", ".msp",
    ".mst", ".pif", ".pkg", ".ps1", ".psm1", ".reg", ".scr", ".sct", ".sh",
    ".sys", ".vb", ".vbe", ".vbs", ".vxd", ".ws", ".wsc", ".wsf", ".wsh",
}
BLOCKED_DETECTED_MIMES = {
    "application/java-archive",
    "application/vnd.microsoft.portable-executable",
    "application/x-apple-diskimage",
    "application/x-dosexec",
    "application/x-executable",
    "application/x-iso9660-image",
    "application/x-mach-binary",
    "application/x-msdownload",
    "application/x-sharedlib",
    "text/x-shellscript",
}
UNSUPPORTED_ARCHIVE_SUFFIXES = {".7z", ".rar", ".gz", ".bz2", ".xz"}


def _specific_mime(path: Path, original_name: str, detected: str) -> str:
    suffix = Path(original_name).suffix.lower()
    zip_like = {"application/zip", "application/octet-stream"}
    if suffix == ".docx" and detected in zip_like:
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    if suffix == ".pptx" and detected in zip_like:
        return "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    if suffix == ".xlsx" and detected in zip_like:
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    if suffix == ".epub" and detected in zip_like:
        return "application/epub+zip"
    if suffix == ".md" and detected.startswith("text/"):
        return "text/markdown"
    return detected


async def _post_callback(request: ProcessRequest, callback: WorkerCallback) -> None:
    callback_url = str(request.callback_url)
    if not _callback_host_allowed(callback_url):
        raise InspectionError("Callback host is not allowlisted")
    body = callback.model_dump(by_alias=True, exclude_none=True)
    delays = [0, 2, 5, 15, 30]
    last_error: Exception | None = None
    async with httpx.AsyncClient(timeout=httpx.Timeout(20, read=90), follow_redirects=False) as client:
        for delay in delays:
            if delay:
                await asyncio.sleep(delay)
            try:
                response = await client.post(
                    callback_url,
                    headers={
                        "Content-Type": "application/json",
                        "x-ednotebook-worker-token": request.callback_token,
                        "User-Agent": "EdNotebook-DocumentSecurityWorker/1.0",
                    },
                    json=body,
                )
                if response.is_success:
                    return
                last_error = RuntimeError(
                    f"Callback returned HTTP {response.status_code}: {response.text[:500]}"
                )
                if response.status_code in {400, 401, 403, 404, 409, 422}:
                    break
            except Exception as error:  # noqa: BLE001 - retry boundary
                last_error = error
    raise last_error or RuntimeError("Worker callback failed")


def _scan_payload(raw_scan: Any, extracted_scan: Any | None) -> dict[str, Any]:
    details: dict[str, Any] = {"raw": raw_scan.details}
    if extracted_scan is not None:
        details["extracted"] = extracted_scan.details
    return {
        "provider": raw_scan.provider,
        "engineVersion": raw_scan.engine_version,
        "signatureVersion": raw_scan.signature_version,
        "details": details,
    }


async def _process(request: ProcessRequest) -> WorkerCallback:
    with tempfile.TemporaryDirectory(prefix=f"ednotebook-{request.file_id}-") as temp:
        workspace = Path(temp)
        downloaded = await download_source(
            str(request.source_url),
            request.expected_size_bytes,
            workspace,
        )
        detected = _specific_mime(
            downloaded.path,
            request.original_name,
            detect_mime(downloaded.path),
        )

        suffix = Path(request.original_name).suffix.lower()
        if suffix in BLOCKED_TOP_LEVEL_SUFFIXES or detected in BLOCKED_DETECTED_MIMES:
            return WorkerCallback(
                fileId=request.file_id,
                verdict="suspicious",
                actualSizeBytes=downloaded.size_bytes,
                sha256=downloaded.sha256,
                detectedMimeType=detected,
                scan={"provider": "file-type-policy", "details": {
                    "suffix": suffix,
                    "detectedMimeType": detected,
                }},
                archive={"status": "not_archive", "details": {}},
                error="Executable, script, disk-image, or binary payloads are not accepted as educational materials.",
            )

        max_scannable = int(os.getenv("MAX_SCANNABLE_BYTES", str(512 * 1024 * 1024)))
        if downloaded.size_bytes > max_scannable:
            return WorkerCallback(
                fileId=request.file_id,
                verdict="error",
                actualSizeBytes=downloaded.size_bytes,
                sha256=downloaded.sha256,
                detectedMimeType=detected,
                scan={"provider": "file-size-policy", "details": {
                    "maxScannableBytes": max_scannable,
                }},
                archive={"status": "pending", "details": {}},
                error="The file exceeds the configured malware-scanning limit and remains quarantined.",
            )

        size_mismatch = downloaded.size_bytes != request.expected_size_bytes
        checksum_mismatch = bool(
            request.expected_sha256
            and downloaded.sha256.lower() != request.expected_sha256.lower()
        )
        if size_mismatch or checksum_mismatch:
            return WorkerCallback(
                fileId=request.file_id,
                verdict="suspicious",
                actualSizeBytes=downloaded.size_bytes,
                sha256=downloaded.sha256,
                detectedMimeType=detected,
                scan={"provider": "preflight", "details": {
                    "sizeMismatch": size_mismatch,
                    "checksumMismatch": checksum_mismatch,
                }},
                archive={"status": "not_archive", "details": {}},
                error="Uploaded bytes do not match the reservation.",
            )

        raw_scan = await clamav_scan(downloaded.path)
        if raw_scan.verdict != "clean":
            return WorkerCallback(
                fileId=request.file_id,
                verdict="infected" if raw_scan.verdict == "infected" else "error",
                actualSizeBytes=downloaded.size_bytes,
                sha256=downloaded.sha256,
                detectedMimeType=detected,
                scan=raw_scan.payload(),
                archive={"status": "pending", "details": {}},
                error=None if raw_scan.verdict == "infected" else "Malware scanner could not return a clean verdict.",
            )

        archive_result: ArchiveResult = inspect_archive(
            downloaded.path,
            request.limits,
            workspace,
        )
        if archive_result.status == "not_archive" and suffix in UNSUPPORTED_ARCHIVE_SUFFIXES:
            archive_result.status = "suspicious"
            archive_result.add_issue("unsupported_archive_format", request.original_name)

        extracted_scan = None
        if archive_result.extracted_directory and archive_result.status == "clean":
            extracted_scan = await clamav_scan(Path(archive_result.extracted_directory), recursive=True)
            if extracted_scan.verdict != "clean":
                return WorkerCallback(
                    fileId=request.file_id,
                    verdict="infected" if extracted_scan.verdict == "infected" else "error",
                    actualSizeBytes=downloaded.size_bytes,
                    sha256=downloaded.sha256,
                    detectedMimeType=detected,
                    scan=_scan_payload(raw_scan, extracted_scan),
                    archive={"status": archive_result.status, "details": archive_result.payload()},
                    error=None if extracted_scan.verdict == "infected" else "Extracted-content scan failed.",
                )

        if archive_result.status in {"blocked", "suspicious", "error"}:
            return WorkerCallback(
                fileId=request.file_id,
                verdict="suspicious" if archive_result.status != "error" else "error",
                actualSizeBytes=downloaded.size_bytes,
                sha256=downloaded.sha256,
                detectedMimeType=detected,
                scan=_scan_payload(raw_scan, extracted_scan),
                archive={"status": archive_result.status, "details": archive_result.payload()},
                error="Archive inspection did not return a clean verdict.",
            )

        previews = []
        preview_error: str | None = None
        if request.preview_requested:
            try:
                previews = make_previews(
                    downloaded.path,
                    detected,
                    workspace,
                    request.limits.max_preview_bytes,
                )
            except PreviewError as error:
                preview_error = str(error)

        manifest = None
        conversion_error: str | None = None
        if request.edubook_requested:
            try:
                manifest = build_edubook(
                    downloaded.path,
                    detected,
                    title=str(request.metadata.get("title") or Path(request.original_name).stem),
                    author=str(request.metadata.get("author") or ""),
                    description=str(request.metadata.get("description") or ""),
                    checksum_sha256=downloaded.sha256,
                    original_name=request.original_name,
                )
            except Exception as error:  # noqa: BLE001 - conversion can be unsupported
                conversion_error = str(error)

        return WorkerCallback(
            fileId=request.file_id,
            verdict="clean",
            actualSizeBytes=downloaded.size_bytes,
            sha256=downloaded.sha256,
            detectedMimeType=detected,
            scan=_scan_payload(raw_scan, extracted_scan),
            archive={
                "status": archive_result.status,
                "details": archive_result.payload(),
            },
            previews=previews,
            eduBookManifest=manifest,
            metadata={
                "previewError": preview_error,
                "conversionError": conversion_error,
                "previewCount": len(previews),
            },
        )


async def _process_and_callback(request: ProcessRequest) -> None:
    async with WORKER_LIMIT:
        try:
            callback = await _process(request)
        except Exception as error:  # noqa: BLE001 - final fail-closed boundary
            callback = WorkerCallback(
                fileId=request.file_id,
                verdict="error",
                scan={"provider": "document-security-worker", "details": {}},
                archive={"status": "error", "details": {}},
                error=str(error)[:4000],
            )
        try:
            await _post_callback(request, callback)
        finally:
            async with ACTIVE_LOCK:
                ACTIVE_JOBS.discard(request.file_id)


@app.get("/healthz")
async def health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": "ednotebook-document-security-worker",
        "activeJobs": len(ACTIVE_JOBS),
    }


@app.post("/v1/process", status_code=status.HTTP_202_ACCEPTED, dependencies=[Depends(require_worker)])
async def process_document(request: ProcessRequest, background_tasks: BackgroundTasks) -> dict[str, Any]:
    async with ACTIVE_LOCK:
        if request.file_id in ACTIVE_JOBS:
            return {"accepted": True, "duplicate": True, "fileId": request.file_id}
        ACTIVE_JOBS.add(request.file_id)

    # Run this image on an always-on worker/VM or Cloud Run with CPU available
    # outside requests. The callback is idempotent and remains fail-closed.
    background_tasks.add_task(_process_and_callback, request)
    return {"accepted": True, "fileId": request.file_id}
