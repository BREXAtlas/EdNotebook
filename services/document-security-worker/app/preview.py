from __future__ import annotations

import base64
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Any

import ebooklib
from bs4 import BeautifulSoup
from ebooklib import epub
from PIL import Image, ImageOps

from .models import PreviewPayload


PDF_MIME = "application/pdf"
WORD_MIMES = {
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
POWERPOINT_MIMES = {
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}
EPUB_MIME = "application/epub+zip"


class PreviewError(RuntimeError):
    pass


def _run(command: list[str], timeout: int = 180, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    process = subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
        env=env,
    )
    if process.returncode != 0:
        output = "\n".join(part for part in [process.stdout.strip(), process.stderr.strip()] if part)
        raise PreviewError(f"Command failed ({process.returncode}): {output[:2000]}")
    return process


def _encode_file(
    path: Path,
    kind: str,
    mime_type: str,
    page_number: int | None = None,
    metadata: dict[str, Any] | None = None,
) -> PreviewPayload:
    return PreviewPayload(
        kind=kind,
        mimeType=mime_type,
        base64=base64.b64encode(path.read_bytes()).decode("ascii"),
        pageNumber=page_number,
        metadata=metadata or {},
    )


def _encode_text(text: str, kind: str = "text", metadata: dict[str, Any] | None = None) -> PreviewPayload:
    data = text.encode("utf-8", errors="replace")
    return PreviewPayload(
        kind=kind,
        mimeType="text/plain",
        base64=base64.b64encode(data).decode("ascii"),
        metadata=metadata or {},
    )


def _webp_thumbnail(source: Path, destination: Path, max_size: tuple[int, int] = (1400, 1800)) -> int:
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image)
        if image.mode not in {"RGB", "RGBA"}:
            image = image.convert("RGB")
        image.thumbnail(max_size, Image.Resampling.LANCZOS)
        if image.mode == "RGBA":
            background = Image.new("RGB", image.size, "white")
            background.paste(image, mask=image.getchannel("A"))
            image = background
        image.save(destination, "WEBP", quality=76, method=6)
    return destination.stat().st_size


def _pdf_previews(pdf_path: Path, workdir: Path, max_bytes: int, max_pages: int = 5) -> list[PreviewPayload]:
    previews: list[PreviewPayload] = []
    used = 0
    prefix = workdir / "page"
    _run([
        "pdftoppm",
        "-f", "1",
        "-l", str(max_pages),
        "-r", "110",
        "-scale-to", "1400",
        "-jpeg",
        "-jpegopt", "quality=72,progressive=y",
        str(pdf_path),
        str(prefix),
    ])

    images = sorted(workdir.glob("page-*.jpg"), key=lambda path: int(path.stem.split("-")[-1]))
    for index, image_path in enumerate(images, start=1):
        webp = workdir / f"page-{index}.webp"
        size = _webp_thumbnail(image_path, webp)
        if used + size > max_bytes:
            break
        used += size
        previews.append(_encode_file(
            webp,
            "thumbnail" if index == 1 else "page",
            "image/webp",
            page_number=index,
            metadata={"source": "pdf", "page": index},
        ))

    text_path = workdir / "document.txt"
    try:
        _run(["pdftotext", "-f", "1", "-l", "30", "-layout", str(pdf_path), str(text_path)])
        text = text_path.read_text("utf-8", errors="replace").strip()[:120_000]
        if text:
            payload_size = len(text.encode("utf-8"))
            if used + payload_size <= max_bytes:
                previews.append(_encode_text(text, metadata={"source": "pdf", "pages": min(len(images), max_pages)}))
    except PreviewError:
        pass
    return previews


def _convert_office_to_pdf(source: Path, workdir: Path) -> Path:
    output = workdir / "office-pdf"
    output.mkdir(parents=True, exist_ok=True)
    profile = workdir / "libreoffice-profile"
    profile.mkdir(parents=True, exist_ok=True)
    environment = os.environ.copy()
    environment["HOME"] = str(workdir)
    _run([
        "libreoffice",
        "--headless",
        f"-env:UserInstallation=file://{profile}",
        "--convert-to", "pdf",
        "--outdir", str(output),
        str(source),
    ], timeout=240, env=environment)
    candidates = sorted(output.glob("*.pdf"))
    if not candidates:
        raise PreviewError("LibreOffice did not produce a PDF preview")
    return candidates[0]


def _image_preview(path: Path, workdir: Path, max_bytes: int) -> list[PreviewPayload]:
    destination = workdir / "thumbnail.webp"
    size = _webp_thumbnail(path, destination, (1600, 1600))
    if size > max_bytes:
        return []
    return [_encode_file(destination, "thumbnail", "image/webp", metadata={"source": "image"})]


def _epub_previews(path: Path, workdir: Path, max_bytes: int) -> list[PreviewPayload]:
    previews: list[PreviewPayload] = []
    used = 0
    book = epub.read_epub(str(path), options={"ignore_ncx": False})

    for item in book.get_items():
        if item.get_type() != ebooklib.ITEM_IMAGE:
            continue
        content = item.get_content()
        if not content or len(content) > 5 * 1024 * 1024:
            continue
        candidate = workdir / f"cover-{Path(item.get_name()).name}"
        candidate.write_bytes(content)
        try:
            output = workdir / "cover.webp"
            size = _webp_thumbnail(candidate, output, (1200, 1600))
        except Exception:
            continue
        if size <= max_bytes:
            previews.append(_encode_file(output, "cover", "image/webp", metadata={"source": item.get_name()}))
            used += size
            break

    text_parts: list[str] = []
    for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
        soup = BeautifulSoup(item.get_content(), "html.parser")
        text = soup.get_text("\n", strip=True)
        if text:
            text_parts.append(text)
        if sum(len(value) for value in text_parts) >= 120_000:
            break
    text = "\n\n".join(text_parts)[:120_000]
    text_size = len(text.encode("utf-8"))
    if text and used + text_size <= max_bytes:
        previews.append(_encode_text(text, metadata={"source": "epub"}))
    return previews


def make_previews(path: Path, mime_type: str, workspace: Path, max_preview_bytes: int) -> list[PreviewPayload]:
    if max_preview_bytes <= 0:
        return []
    preview_dir = Path(tempfile.mkdtemp(prefix="preview-", dir=workspace))
    try:
        if mime_type.startswith("image/"):
            return _image_preview(path, preview_dir, max_preview_bytes)
        if mime_type == PDF_MIME:
            return _pdf_previews(path, preview_dir, max_preview_bytes)
        if mime_type in WORD_MIMES | POWERPOINT_MIMES:
            pdf = _convert_office_to_pdf(path, preview_dir)
            return _pdf_previews(pdf, preview_dir, max_preview_bytes)
        if mime_type == EPUB_MIME:
            return _epub_previews(path, preview_dir, max_preview_bytes)
        if mime_type.startswith("text/") or mime_type in {"application/json"}:
            text = path.read_text("utf-8", errors="replace")[:120_000]
            if len(text.encode("utf-8")) <= max_preview_bytes:
                return [_encode_text(text, metadata={"source": mime_type})]
    except Exception as error:  # conversion libraries expose different error classes by version
        raise PreviewError(str(error)) from error
    return []
