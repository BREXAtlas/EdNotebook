from __future__ import annotations

from pathlib import Path

from app.edubook import build_edubook


def test_markdown_converts_to_chapters(tmp_path: Path):
    source = tmp_path / "reading.md"
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

    assert manifest["format"] == "EduBook/1.0"
    assert manifest["title"] == "Digital Evidence"
    assert manifest["author"] == "Professor Example"
    assert [chapter["title"] for chapter in manifest["chapters"]] == ["Opening", "Evidence"]
    assert manifest["source"]["words"] >= 8
    assert manifest["learningDesign"]["teacherLayerSeparatedFromSource"] is True


def test_plain_text_stays_source_grounded(tmp_path: Path):
    source = tmp_path / "reading.txt"
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
    assert "Paragraph one." in combined
    assert "Paragraph two." in combined
    assert all(chapter["knowledgeChecks"] == [] for chapter in manifest["chapters"])
