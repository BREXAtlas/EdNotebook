# EduBook/1.0

EduBook is EdNotebook’s portable teaching-publication manifest. It is not intended to replace PDF, EPUB, DOCX, or a publisher’s archival source. It adds the instructional structure those files do not consistently contain.

## Goals

- convert a reading into an assignable lesson experience
- preserve title, author, source, rights, and version information
- break content into addressable chapters and blocks
- record reading progress without rewriting the source
- support private notes, highlights, questions, and bookmarks
- attach knowledge checks and discussion prompts
- represent assignment, purchase, rental, open-access, and private-draft models
- permit multiple renderers: EdNotebook web reader, mobile reader, accessible text renderer, or future publisher app

## Non-goals

- circumventing DRM or publisher access controls
- ingesting material without ownership or permission
- claiming that client-side parsing can perfectly convert every PDF, EPUB, Word file, or publisher package
- replacing a publisher’s master production files

## Manifest example

```json
{
  "format": "EduBook/1.0",
  "title": "Teaching Digital Systems",
  "author": "Author Name",
  "description": "An interactive reading.",
  "language": "en",
  "source": {
    "type": "application/epub+zip",
    "originalName": "teaching-digital-systems.epub",
    "safeName": "2026-07-18_dlit-101_book-source_teaching-digital-systems_v01.epub",
    "checksumSha256": "…",
    "importedAt": "2026-07-18T00:00:00.000Z"
  },
  "rights": {
    "confirmed": true,
    "statement": "The uploader owns or is authorized to distribute this work."
  },
  "learningDesign": {
    "mode": "interactive-reading",
    "annotations": true,
    "bookmarks": true,
    "progress": true,
    "checks": true,
    "discussion": true
  },
  "chapters": [
    {
      "id": "chapter-uuid",
      "title": "Opening",
      "blocks": [
        {
          "id": "block-uuid",
          "type": "paragraph",
          "text": "…"
        }
      ],
      "knowledgeChecks": [],
      "discussionPrompts": []
    }
  ]
}
```

## Source conversion

### Immediate browser conversion

Plain text and Markdown can be converted safely in the browser into chapters and paragraph blocks. Markdown headings establish chapter boundaries.

### Server-side conversion queue

PDF, DOCX, EPUB, ZIP, and publisher packages should enter a server-side queue:

1. authenticate and confirm rights
2. store the untouched source in the private publication bucket
3. verify checksum and file type
4. scan and quarantine the source
5. extract text, headings, images, tables, footnotes, and navigation
6. preserve locators back to the source
7. create a draft EduBook manifest
8. use an LLM only for proposed learning structure, never as the sole source of the book text
9. run accessibility and rights checks
10. require author/publisher/professor review
11. publish a versioned manifest

OCR should be used only when the source genuinely lacks machine-readable text and the rights holder allows conversion.

## Annotations

Annotations are stored outside the book manifest so readers can have private or course-specific layers without modifying the publication.

Supported types:

- note
- highlight
- question
- bookmark

Each annotation contains a publication ID, user ID, stable locator, optional selected text, note content, type, and metadata such as chapter title and progress.

## Progress

The launch reader records progress as the current chapter position. A production reader should store more precise locators:

- chapter ID
- block ID
- character or sentence offset
- page/spread number when the renderer has pages
- last-opened timestamp
- completed percentage

Progress belongs to the user/publication entitlement, not to the publication master file.

## Learning conversion

A professor can transform a book or chapter into a lesson without altering the author’s text:

- learning outcomes
- pre-reading question
- vocabulary
- verification prompts
- knowledge checks
- discussion prompts
- assignment connection
- reflection

These elements should be stored as a course learning layer that references chapter/block locators.

## Rights and marketplace status

Every publication record includes:

- rights confirmation
- rights statement
- owner
- source format and checksum
- conversion status
- access model
- optional price or rental period
- editorial status

Commercial listings require partner approval. A publication record alone does not create a storefront entitlement or authorize a sale.

## Access models

- `private`: visible only to its owner
- `assigned`: distributed through an authorized course
- `open`: openly available under the declared rights terms
- `purchase`: permanent entitlement after successful payment
- `rental`: time-limited entitlement after successful payment

Stripe or another payment service should create entitlements server-side after verified webhooks. The browser must not grant access merely because it returns from Checkout.

## Portability

The JSON manifest can be downloaded as `.edubook.json`. Future renderers should ignore unknown fields, honor the `format` version, and preserve stable IDs when round-tripping edits.
