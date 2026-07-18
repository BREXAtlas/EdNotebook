from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, HttpUrl, field_validator


class ProcessingLimits(BaseModel):
    max_archive_entries: int = Field(default=5_000, ge=1, le=100_000, alias="maxArchiveEntries")
    max_expanded_bytes: int = Field(default=262_144_000, ge=1, alias="maxExpandedBytes")
    max_compression_ratio: float = Field(default=100, ge=1, le=10_000, alias="maxCompressionRatio")
    max_archive_depth: int = Field(default=2, ge=0, le=5, alias="maxArchiveDepth")
    max_preview_bytes: int = Field(default=8_388_608, ge=0, le=50_000_000, alias="maxPreviewBytes")

    model_config = {"populate_by_name": True}


class ProcessRequest(BaseModel):
    file_id: str = Field(alias="fileId", min_length=36, max_length=36)
    source_url: HttpUrl = Field(alias="sourceUrl")
    original_name: str = Field(alias="originalName", min_length=1, max_length=512)
    safe_name: str = Field(alias="safeName", min_length=1, max_length=255)
    claimed_mime_type: str | None = Field(default=None, alias="claimedMimeType", max_length=255)
    expected_size_bytes: int = Field(alias="expectedSizeBytes", gt=0)
    expected_sha256: str | None = Field(default=None, alias="expectedSha256")
    purpose: Literal["private", "course", "submission", "publication", "preview", "export"]
    preview_requested: bool = Field(default=False, alias="previewRequested")
    edubook_requested: bool = Field(default=False, alias="eduBookRequested")
    callback_url: HttpUrl = Field(alias="callbackUrl")
    callback_token: str = Field(alias="callbackToken", min_length=24, max_length=512)
    metadata: dict[str, Any] = Field(default_factory=dict)
    limits: ProcessingLimits = Field(default_factory=ProcessingLimits)

    model_config = {"populate_by_name": True}

    @field_validator("expected_sha256")
    @classmethod
    def validate_sha256(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.lower()
        if len(normalized) != 64 or any(character not in "0123456789abcdef" for character in normalized):
            raise ValueError("expectedSha256 must contain 64 hexadecimal characters")
        return normalized


class PreviewPayload(BaseModel):
    kind: Literal["thumbnail", "page", "text", "html", "cover", "slides", "metadata"]
    mime_type: str = Field(alias="mimeType")
    base64: str
    page_number: int | None = Field(default=None, alias="pageNumber")
    metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = {"populate_by_name": True}


class WorkerCallback(BaseModel):
    file_id: str = Field(alias="fileId")
    verdict: Literal["clean", "infected", "suspicious", "error"]
    actual_size_bytes: int | None = Field(default=None, alias="actualSizeBytes")
    sha256: str | None = None
    detected_mime_type: str | None = Field(default=None, alias="detectedMimeType")
    scan: dict[str, Any] = Field(default_factory=dict)
    archive: dict[str, Any] = Field(default_factory=dict)
    previews: list[PreviewPayload] = Field(default_factory=list)
    edu_book_manifest: dict[str, Any] | None = Field(default=None, alias="eduBookManifest")
    metadata: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None

    model_config = {"populate_by_name": True}
