from __future__ import annotations

import asyncio
import hashlib
import ipaddress
import os
import shutil
import stat
import subprocess
import tarfile
import tempfile
import zipfile
from dataclasses import asdict, dataclass, field
from pathlib import Path, PurePosixPath
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx
import magic

from .models import ProcessingLimits


BLOCKED_SUFFIXES = {
    ".ade", ".adp", ".apk", ".app", ".bat", ".cab", ".chm", ".cmd",
    ".com", ".cpl", ".dll", ".dmg", ".exe", ".gadget", ".hta", ".img", ".inf",
    ".ins", ".iso", ".jar", ".js", ".jse", ".lnk", ".msc", ".msi", ".msp",
    ".mst", ".pif", ".pkg", ".ps1", ".psm1", ".reg", ".scr", ".sct", ".sh",
    ".sys", ".vb", ".vbe", ".vbs", ".vxd", ".ws", ".wsc", ".wsf", ".wsh",
}

ARCHIVE_SUFFIXES = {
    ".zip", ".tar", ".tgz", ".gz", ".bz2", ".xz", ".7z", ".rar",
}

MACRO_MARKERS = {
    "vbaproject.bin",
    "word/vbaproject.bin",
    "ppt/vbaproject.bin",
    "xl/vbaproject.bin",
}


@dataclass
class ScanResult:
    verdict: str
    provider: str = "ClamAV"
    engine_version: str | None = None
    signature_version: str | None = None
    details: dict[str, Any] = field(default_factory=dict)

    def payload(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "engineVersion": self.engine_version,
            "signatureVersion": self.signature_version,
            "details": self.details,
        }


@dataclass
class ArchiveResult:
    status: str = "not_archive"
    entries: int = 0
    expanded_bytes: int = 0
    compressed_bytes: int = 0
    max_ratio: float = 0.0
    encrypted_entries: int = 0
    nested_archives: int = 0
    issues: list[dict[str, Any]] = field(default_factory=list)
    extracted_directory: str | None = None

    def add_issue(self, code: str, member: str | None = None, detail: str | None = None) -> None:
        issue: dict[str, Any] = {"code": code}
        if member:
            issue["member"] = member[:500]
        if detail:
            issue["detail"] = detail[:1000]
        self.issues.append(issue)

    def payload(self) -> dict[str, Any]:
        data = asdict(self)
        data.pop("extracted_directory", None)
        return data


@dataclass
class DownloadResult:
    path: Path
    size_bytes: int
    sha256: str
    content_type: str | None


class InspectionError(RuntimeError):
    pass


def _allowed_source_hosts() -> set[str]:
    configured = {
        value.strip().lower()
        for value in os.getenv("ALLOWED_SOURCE_HOSTS", "").split(",")
        if value.strip()
    }
    project_ref = os.getenv("SUPABASE_PROJECT_REF", "").strip().lower()
    if project_ref:
        configured.update({
            f"{project_ref}.supabase.co",
            f"{project_ref}.storage.supabase.co",
            f"{project_ref}.functions.supabase.co",
        })
    if not configured:
        raise InspectionError("ALLOWED_SOURCE_HOSTS or SUPABASE_PROJECT_REF must be configured")
    return configured


def _validate_remote_url(value: str, allowed_hosts: set[str]) -> None:
    parsed = urlparse(value)
    if parsed.scheme != "https":
        raise InspectionError("Only HTTPS source and callback URLs are allowed")
    if parsed.username or parsed.password:
        raise InspectionError("URLs containing credentials are not allowed")
    host = (parsed.hostname or "").lower().rstrip(".")
    if host not in allowed_hosts:
        raise InspectionError(f"Remote host is not allowlisted: {host}")
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        return
    if not address.is_global:
        raise InspectionError("Private and reserved IP addresses are blocked")


async def download_source(url: str, expected_size: int, directory: Path) -> DownloadResult:
    allowed_hosts = _allowed_source_hosts()
    _validate_remote_url(url, allowed_hosts)
    hard_limit = int(os.getenv("MAX_SOURCE_BYTES", str(5 * 1024 * 1024 * 1024)))
    size_limit = min(hard_limit, expected_size + max(1_048_576, expected_size // 100))
    destination = directory / "source.bin"
    digest = hashlib.sha256()
    total = 0
    current_url = url

    async with httpx.AsyncClient(timeout=httpx.Timeout(30, read=300), follow_redirects=False) as client:
        for _ in range(4):
            _validate_remote_url(current_url, allowed_hosts)
            async with client.stream(
                "GET",
                current_url,
                headers={"User-Agent": "EdNotebook-DocumentSecurityWorker/1.0"},
            ) as response:
                if response.status_code in {301, 302, 303, 307, 308}:
                    location = response.headers.get("location")
                    if not location:
                        raise InspectionError("Source returned an invalid redirect")
                    current_url = urljoin(current_url, location)
                    continue
                response.raise_for_status()
                claimed_length = int(response.headers.get("content-length") or 0)
                if claimed_length and claimed_length > size_limit:
                    raise InspectionError("Source content length exceeds the upload reservation")
                with destination.open("wb") as output:
                    async for chunk in response.aiter_bytes(1024 * 1024):
                        total += len(chunk)
                        if total > size_limit:
                            raise InspectionError("Downloaded bytes exceed the upload reservation")
                        digest.update(chunk)
                        output.write(chunk)
                return DownloadResult(
                    path=destination,
                    size_bytes=total,
                    sha256=digest.hexdigest(),
                    content_type=response.headers.get("content-type"),
                )
    raise InspectionError("Source returned too many redirects")


def detect_mime(path: Path) -> str:
    try:
        return str(magic.from_file(str(path), mime=True) or "application/octet-stream")
    except Exception:
        return "application/octet-stream"


def _clamav_versions() -> tuple[str | None, str | None]:
    try:
        output = subprocess.check_output(
            ["clamscan", "--version"],
            text=True,
            stderr=subprocess.STDOUT,
            timeout=15,
        ).strip()
        # Example: ClamAV 1.0.9/27670/Fri Jul 18 08:13:19 2026
        pieces = output.split("/")
        engine = pieces[0].replace("ClamAV", "").strip() if pieces else output
        signature = pieces[1].strip() if len(pieces) > 1 else None
        return engine or None, signature or None
    except Exception:
        return None, None


def _has_clamav_database() -> bool:
    database = Path(os.getenv("CLAMAV_DATABASE", "/var/lib/clamav"))
    return database.exists() and any(database.glob("*.c?d"))


async def clamav_scan(path: Path, recursive: bool = False) -> ScanResult:
    engine, signatures = _clamav_versions()
    if not _has_clamav_database():
        return ScanResult(
            verdict="error",
            engine_version=engine,
            signature_version=signatures,
            details={"reason": "malware_signatures_unavailable"},
        )

    command = [
        "clamscan",
        f"--database={os.getenv('CLAMAV_DATABASE', '/var/lib/clamav')}",
        "--infected",
        "--no-summary",
        "--max-filesize=512M",
        "--max-scansize=1G",
        "--max-recursion=25",
    ]
    if recursive:
        command.append("--recursive")
    command.append(str(path))

    def run() -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=int(os.getenv("CLAMAV_TIMEOUT_SECONDS", "300")),
            check=False,
        )

    try:
        process = await asyncio.to_thread(run)
    except subprocess.TimeoutExpired:
        return ScanResult(
            verdict="error",
            engine_version=engine,
            signature_version=signatures,
            details={"reason": "malware_scan_timeout"},
        )

    output = "\n".join(part for part in [process.stdout.strip(), process.stderr.strip()] if part)
    if process.returncode == 0:
        verdict = "clean"
    elif process.returncode == 1:
        verdict = "infected"
    else:
        verdict = "error"
    return ScanResult(
        verdict=verdict,
        engine_version=engine,
        signature_version=signatures,
        details={"returnCode": process.returncode, "output": output[:4000]},
    )


def _safe_target(root: Path, member_name: str) -> Path:
    normalized = member_name.replace("\\", "/")
    pure = PurePosixPath(normalized)
    if pure.is_absolute() or ".." in pure.parts or "\x00" in normalized:
        raise InspectionError("Archive contains a path-traversal entry")
    target = (root / Path(*pure.parts)).resolve()
    if root.resolve() not in target.parents and target != root.resolve():
        raise InspectionError("Archive entry escapes the extraction directory")
    return target


def _blocked_member(name: str) -> str | None:
    lowered = name.lower().replace("\\", "/")
    basename = PurePosixPath(lowered).name
    if basename in MACRO_MARKERS or lowered.endswith("/vbaproject.bin"):
        return "office_macro"
    if "/activex/" in f"/{lowered}" or "/embeddings/oleobject" in f"/{lowered}":
        return "active_content"
    suffix = Path(basename).suffix.lower()
    if suffix in BLOCKED_SUFFIXES:
        return f"blocked_extension:{suffix}"
    return None


def _looks_nested_archive(name: str) -> bool:
    lowered = name.lower()
    return any(lowered.endswith(suffix) for suffix in ARCHIVE_SUFFIXES)


def _inspect_zip(
    path: Path,
    extraction_root: Path,
    limits: ProcessingLimits,
    result: ArchiveResult,
    depth: int,
    counters: dict[str, int],
) -> None:
    if depth > limits.max_archive_depth:
        result.status = "blocked"
        result.add_issue("archive_depth_exceeded", str(path))
        return

    with zipfile.ZipFile(path) as archive:
        for info in archive.infolist():
            counters["entries"] += 1
            result.entries += 1
            if counters["entries"] > limits.max_archive_entries:
                result.status = "blocked"
                result.add_issue("too_many_archive_entries", info.filename)
                return
            if info.flag_bits & 0x1:
                result.encrypted_entries += 1
                result.status = "blocked"
                result.add_issue("encrypted_archive_entry", info.filename)
                continue
            unix_mode = (info.external_attr >> 16) & 0o170000
            if unix_mode == stat.S_IFLNK:
                result.status = "blocked"
                result.add_issue("archive_symlink", info.filename)
                continue
            try:
                target = _safe_target(extraction_root, info.filename)
            except InspectionError as error:
                result.status = "blocked"
                result.add_issue("archive_path_traversal", info.filename, str(error))
                continue

            blocked = _blocked_member(info.filename)
            if blocked:
                result.status = "blocked"
                result.add_issue(blocked, info.filename)

            result.compressed_bytes += max(info.compress_size, 0)
            result.expanded_bytes += max(info.file_size, 0)
            counters["expanded"] += max(info.file_size, 0)
            ratio = info.file_size / max(info.compress_size, 1)
            result.max_ratio = max(result.max_ratio, ratio)
            if counters["expanded"] > limits.max_expanded_bytes:
                result.status = "blocked"
                result.add_issue("archive_expanded_size_exceeded", info.filename)
                return
            if info.file_size > 1_048_576 and ratio > limits.max_compression_ratio:
                result.status = "blocked"
                result.add_issue("archive_compression_ratio_exceeded", info.filename, f"ratio={ratio:.2f}")
                continue
            if info.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue

            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(info, "r") as source, target.open("wb") as output:
                copied = 0
                while True:
                    chunk = source.read(1024 * 1024)
                    if not chunk:
                        break
                    copied += len(chunk)
                    if copied > info.file_size + 1_024:
                        raise InspectionError("Archive entry exceeded its declared size")
                    output.write(chunk)

            if _looks_nested_archive(info.filename):
                result.nested_archives += 1
                nested_root = extraction_root / f"nested-{result.nested_archives}"
                nested_root.mkdir(parents=True, exist_ok=True)
                _inspect_archive_recursive(target, nested_root, limits, result, depth + 1, counters)


def _inspect_tar(
    path: Path,
    extraction_root: Path,
    limits: ProcessingLimits,
    result: ArchiveResult,
    depth: int,
    counters: dict[str, int],
) -> None:
    if depth > limits.max_archive_depth:
        result.status = "blocked"
        result.add_issue("archive_depth_exceeded", str(path))
        return

    with tarfile.open(path, mode="r:*") as archive:
        for member in archive.getmembers():
            counters["entries"] += 1
            result.entries += 1
            if counters["entries"] > limits.max_archive_entries:
                result.status = "blocked"
                result.add_issue("too_many_archive_entries", member.name)
                return
            if member.issym() or member.islnk() or member.isdev():
                result.status = "blocked"
                result.add_issue("archive_special_entry", member.name)
                continue
            try:
                target = _safe_target(extraction_root, member.name)
            except InspectionError as error:
                result.status = "blocked"
                result.add_issue("archive_path_traversal", member.name, str(error))
                continue
            blocked = _blocked_member(member.name)
            if blocked:
                result.status = "blocked"
                result.add_issue(blocked, member.name)

            result.expanded_bytes += max(member.size, 0)
            counters["expanded"] += max(member.size, 0)
            if counters["expanded"] > limits.max_expanded_bytes:
                result.status = "blocked"
                result.add_issue("archive_expanded_size_exceeded", member.name)
                return
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            if not member.isfile():
                continue

            source = archive.extractfile(member)
            if source is None:
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with source, target.open("wb") as output:
                shutil.copyfileobj(source, output, length=1024 * 1024)

            if _looks_nested_archive(member.name):
                result.nested_archives += 1
                nested_root = extraction_root / f"nested-{result.nested_archives}"
                nested_root.mkdir(parents=True, exist_ok=True)
                _inspect_archive_recursive(target, nested_root, limits, result, depth + 1, counters)


def _inspect_archive_recursive(
    path: Path,
    extraction_root: Path,
    limits: ProcessingLimits,
    result: ArchiveResult,
    depth: int,
    counters: dict[str, int],
) -> None:
    if zipfile.is_zipfile(path):
        _inspect_zip(path, extraction_root, limits, result, depth, counters)
        return
    if tarfile.is_tarfile(path):
        _inspect_tar(path, extraction_root, limits, result, depth, counters)
        return
    result.status = "suspicious"
    result.add_issue("unsupported_nested_archive", path.name)


def inspect_archive(path: Path, limits: ProcessingLimits, workspace: Path) -> ArchiveResult:
    result = ArchiveResult()
    is_zip = zipfile.is_zipfile(path)
    is_tar = False
    if not is_zip:
        try:
            is_tar = tarfile.is_tarfile(path)
        except Exception:
            is_tar = False
    if not is_zip and not is_tar:
        return result

    extraction_root = Path(tempfile.mkdtemp(prefix="archive-", dir=workspace))
    result.status = "clean"
    result.extracted_directory = str(extraction_root)
    counters = {"entries": 0, "expanded": 0}
    try:
        _inspect_archive_recursive(path, extraction_root, limits, result, 0, counters)
    except (zipfile.BadZipFile, tarfile.TarError, OSError, InspectionError) as error:
        result.status = "error"
        result.add_issue("archive_inspection_error", detail=str(error))
    return result
