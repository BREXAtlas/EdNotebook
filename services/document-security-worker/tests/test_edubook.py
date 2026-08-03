from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from app.edubook import build_edubook


class EduBookConversionTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.tmp_path = Path(self.temp_dir.name)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_markdown_converts_to_chapters(self):
        source = self.tmp_path / "reading.md"
        source.write_text(
            "# Opening\n\nA first paragraph.\n\n# Evidence\n\nA second paragraph with a source.",
            encoding="utf-8",
        )

        manifest = build_edubook(
            source,
            "text/markdown",
            title="Digital Evidence",
            author="Professor Example",
            checksum_sha256="a" * 64,
            original_name="reading.md",
        )

        self.assertEqual(manifest["format"], "EduBook/1.0")
        self.assertEqual(manifest["title"], "Digital Evidence")
        self.assertEqual(manifest["author"], "Professor Example")
        self.assertEqual(
            [chapter["title"] for chapter in manifest["chapters"]],
            ["Opening", "Evidence"],
        )
        self.assertGreaterEqual(manifest["source"]["words"], 8)
        self.assertTrue(
            manifest["learningDesign"]["teacherLayerSeparatedFromSource"]
        )

    def test_plain_text_stays_source_grounded(self):
        source = self.tmp_path / "reading.txt"
        source.write_text("Paragraph one.\n\nParagraph two.", encoding="utf-8")

        manifest = build_edubook(
            source,
            "text/plain",
            title="Plain Reading",
            original_name="reading.txt",
        )

        combined = " ".join(
            block.get("text", "")
            for chapter in manifest["chapters"]
            for block in chapter["blocks"]
        )
        self.assertIn("Paragraph one.", combined)
        self.assertIn("Paragraph two.", combined)
        self.assertTrue(
            all(
                chapter["knowledgeChecks"] == []
                for chapter in manifest["chapters"]
            )
        )
