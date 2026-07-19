# EdNotebook integration roadmap

## Integration principle

External tools are capabilities, not the source of truth for the course. Every connector maps into EdNotebook-owned models for:

- user and course tenancy
- document or resource identity
- placement in a lesson or assignment
- rights and attribution
- version and checksum
- assessment and grade status
- access and retention

The UI registry is defined in `src/studio/pluginRegistry.js`.

## YouTube — live now

The materials panel detects common YouTube URL forms and creates a privacy-enhanced embed using `youtube-nocookie.com`.

Launch behavior:

- no API key required for playback embeds
- video stays inside a named lesson/resource panel
- the original URL and detected video ID are stored in `learning_resources`
- the professor adds the learner-facing title and purpose

Future server enrichment can use the YouTube Data API for validated title, channel, duration, captions, and availability. API keys belong server-side.

## Microsoft Word / EduSync — prepared

The proprietary writing model should use an explicit document format rather than treating DOCX as the application database.

Proposed format: `EduSync/1.0`

```json
{
  "format": "EduSync/1.0",
  "documentId": "uuid",
  "title": "Research paper",
  "blocks": [
    {
      "id": "stable-block-id",
      "type": "paragraph",
      "text": "…",
      "style": "body",
      "citations": [],
      "comments": []
    }
  ],
  "version": 12,
  "updatedAt": "…"
}
```

### Word add-in flow

1. Register a Microsoft 365 Office Add-in and Entra application.
2. Install the add-in for Word web, Windows, Mac, and supported mobile environments.
3. Authenticate the EdNotebook user through OAuth/PKCE.
4. Map Word paragraphs, headings, comments, and selections to stable EduSync block IDs.
5. Send incremental changes to an authenticated EdNotebook sync API.
6. Store versions and conflict metadata server-side.
7. Allow professor annotations to return to the correct Word range when possible.
8. Export a clean DOCX without requiring Word to understand every EdNotebook teaching feature.

The browser app now saves assignment drafts in an EduSync-shaped JSON object. The actual Word add-in and sync API still require their own repository/deployment and Microsoft registration.

## Canva — prepared

EdNotebook’s presentation source is `EdSlides/1.0`. Canva can become a visual editor and export renderer.

Proposed flow:

1. Register a Canva developer app.
2. Authenticate the user and launch Canva from the EdNotebook slide record.
3. Send slide text, notes, visual direction, and selected assets to the Canva app.
4. Let the user create or edit the design.
5. Export PNG/PDF/PPTX through the Canva Apps SDK.
6. Retrieve short-lived export files through an authenticated backend.
7. Store the chosen result in the private course-material bucket.
8. Keep the EdSlides manifest and Canva design ID together for future synchronization.

Do not put Canva client secrets or privileged export tokens in the Vite bundle.

## Cengage — partner/LTI preparation

Cengage integrations are normally institution- and platform-mediated. EdNotebook should implement LTI 1.3 / LTI Advantage rather than scrape or deep-link around access rules.

Required capabilities:

- LTI platform registration
- OIDC login initiation
- signed launch validation
- deep linking/content-item selection
- course and role context
- Assignment and Grade Services for grade return
- Names and Role Provisioning when contractually allowed
- deployment and institution configuration
- partner onboarding and any data review required by the participating institution

EdNotebook can operate as an LTI platform, an LTI tool, or both depending on the institutional architecture. Credentials and registration metadata must be stored server-side.

## Supabase Storage — live now

Supabase is the launch object store because the app already uses Supabase Auth and Postgres RLS. The storage adapter lives in `src/studio/storageService.js`.

Live buckets:

- private vault
- course materials
- submissions
- publications

The adapter deliberately returns `{ bucket, path, safeName, checksumSha256 }` so another provider can implement the same higher-level contract.

## Cloudflare R2 — overflow adapter

R2 is a strong candidate for larger publisher catalogs or high-egress assets, but it should be added through a server-side S3-compatible service.

Required work:

- create an R2 bucket and lifecycle rules
- store credentials only in an Edge Function or API service
- create upload sessions or signed URLs after validating user/course access
- scan uploads before release
- write the resulting provider/path/checksum into `learning_resources` or `publications`
- generate time-limited downloads after entitlement checks
- implement object deletion and retention events

R2 should not be used directly from the public Vite bundle with write credentials.

## Google Drive and SharePoint/OneDrive — optional institutional connectors

External document systems can be import/export locations, but EdNotebook must retain:

- course placement
- original source link
- imported version/checksum
- rights and attribution metadata
- mapped access level
- explicit synchronization status

A connector should warn when a Drive/SharePoint permission is broader than the EdNotebook course membership.

## Plugin interface direction

A future server plugin registry should expose operations such as:

```text
configure
connect
refresh-token
import
export
preview
sync
revoke
audit
```

Each operation should declare:

- required scopes
- allowed roles
- supported resource types
- data sent outside EdNotebook
- token storage location
- retention and deletion behavior
- whether an institutional administrator must approve it

## Partner sign-up

The new `publisher_applications` table captures publisher, independent author, professor-author, institution, and supplier applications. Approval should occur before commercial catalog publication.

Review areas:

- identity and organization
- rights and territories
- accessibility
- pricing and refund model
- metadata quality
- content safety and academic integrity
- support contact
- tax/payment onboarding
- institutional licensing terms
