from __future__ import annotations

import tempfile
import unittest
import zipfile
from pathlib import Path

from app.inspection import inspect_archive
from app.models import ProcessingLimits


def limits(**overrides):
    values = {
        "maxArchiveEntries": 100,
        "maxExpandedBytes": 2_000_000,
        "maxCompressionRatio": 100,
        "maxArchiveDepth": 1,
        "maxPreviewBytes": 1_000_000,
    }
    values.update(overrides)
    return ProcessingLimits.model_validate(values)


def make_zip(path: Path, members: dict[str, bytes]) -> Path:
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, content in members.items():
            archive.writestr(name, content)
    return path


class ArchiveInspectionTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.tmp_path = Path(self.temp_dir.name)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_safe_office_package_is_clean(self):
        source = make_zip(self.tmp_path / "safe.docx", {
            "[Content_Types].xml": b"<Types/>",
            "word/document.xml": b"<document><p>Safe text</p></document>",
            "word/styles.xml": b"<styles/>",
        })
        result = inspect_archive(source, limits(), self.tmp_path)
        self.assertEqual(result.status, "clean")
        self.assertEqual(result.entries, 3)

    def test_path_traversal_is_blocked(self):
        source = make_zip(self.tmp_path / "traversal.zip", {
            "../../outside.txt": b"not allowed",
        })
        result = inspect_archive(source, limits(), self.tmp_path)
        self.assertEqual(result.status, "blocked")
        self.assertTrue(
            any(issue["code"] == "archive_path_traversal" for issue in result.issues)
        )

    def test_office_macro_is_blocked(self):
        source = make_zip(self.tmp_path / "macro.docx", {
            "word/document.xml": b"<document/>",
            "word/vbaProject.bin": b"macro",
        })
        result = inspect_archive(source, limits(), self.tmp_path)
        self.assertEqual(result.status, "blocked")
        self.assertTrue(any(issue["code"] == "office_macro" for issue in result.issues))

    def test_excessive_expansion_is_blocked(self):
        source = make_zip(self.tmp_path / "bomb.zip", {
            "large.txt": b"A" * 200_000,
        })
        result = inspect_archive(
            source,
            limits(maxExpandedBytes=100_000, maxCompressionRatio=10_000),
            self.tmp_path,
        )
        self.assertEqual(result.status, "blocked")
        self.assertTrue(
            any(
                issue["code"] == "archive_expanded_size_exceeded"
                for issue in result.issues
            )
        )

    def test_script_payload_is_blocked(self):
        source = make_zip(self.tmp_path / "script.zip", {
            "lesson/readme.txt": b"context",
            "lesson/run.ps1": b"Write-Host unsafe",
        })
        result = inspect_archive(source, limits(), self.tmp_path)
        self.assertEqual(result.status, "blocked")
        self.assertTrue(
            any(issue["code"].startswith("blocked_extension") for issue in result.issues)
        )
