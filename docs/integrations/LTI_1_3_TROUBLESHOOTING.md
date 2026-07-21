# LTI 1.3 troubleshooting

Use the safe correlation/reference shown to the user and redacted audit/sync records. Never request a raw JWT, access token, private key, Blackboard password, full roster response, or student-grade payload in email or a ticket.

| Symptom | Likely check | Safe resolution |
| --- | --- | --- |
| Registration not found or ambiguous | Issuer/client mismatch or duplicate | Compare the exact HTTPS issuer, including any documented trailing slash, and the exact client ID |
| Deployment not enabled | ID mismatch or status setup/suspended | Copy the exact Blackboard deployment ID and move both records to testing |
| Target link not registered | Exact URL mismatch | Add the server `lti-launch` URL shown in owner setup; do not wildcard arbitrary origins |
| Signing key not registered | Wrong `kid` or stale platform JWKS | Verify Blackboard JWKS and key cache; rotate with current/previous key window |
| Signature invalid | Altered token, wrong issuer/key, clock | Check Blackboard/tool clocks and registered JWKS; do not bypass validation |
| State/nonce expired or replayed | Launch older than five minutes, refresh of POST | Start a new Blackboard launch; a consumed state must never be reused |
| Account link says already linked | Same LTI `sub` mapped elsewhere | Institution records owner reviews the existing mapping; do not merge by email |
| Course needs mapping | First valid context launch | Owner maps the pending context to the existing same-institution EdNotebook course |
| Resource is pending/unavailable | Context/content unpublished or link lacks validated custom target | Publish the EdNotebook package and recreate/test the Deep Link |
| Deep Linking unavailable | Resource launch instead of Deep Linking request, missing return URL | Start the Blackboard content-selection placement and verify Deep Linking is enabled |
| NRPS not granted | Missing signed claim/scope or registration approval | Enable only the approved NRPS scope in Blackboard and EdNotebook, then relaunch |
| Roster pagination rejected | `next` link changed host | Add only the legitimate LMS service hostname after IT review; investigate unexpected redirect/host |
| AGS line-item creation denied | Missing line-item scope/URL | Approve the exact AGS scope, relaunch, and use a published same-course grade item |
| Learner has no grade mapping | LTI subject not linked | Learner completes a valid launch and explicit account link; do not infer from name |
| Grade release blocked | Grade not finalized, mapping held/disabled, no confirmation | Finalize/review grade, enable mapping, and use professor Confirm and release |
| AGS HTTP failure | LMS permissions, endpoint, token, availability | Review bounded event status/HTTP code; correct entitlement/host and use Retry |
| Duplicate grade concern | Same source grade already sent | Idempotency returns the succeeded event; verify Blackboard rather than resend manually |
| Activation refused | Required live evidence missing | Complete the named instructor/learner/context/NRPS/line-item/passback test; never edit status around the gate |
| Works after refresh only | stale frontend/function deployment or session race | Confirm current Pages build and Edge Function versions, clear service worker/cache if applicable, and collect correlation ID—not secrets |

## Operator checks

- Registration/deployment status and exact values at `#/admin/integrations/lti`.
- `lti_launch_states`: count/expiry/consumed time only; never plaintext.
- Context/user/resource mapping status and same-institution/course relationship.
- Service granted scopes and hostname, without tokens.
- Grade/roster sync status, attempt/count/error code, and redacted audit event.
- Supabase function availability/timeout and clock.
- Blackboard service health and administrator entitlements.

## Safe rollback

1. Set the affected deployment or registration to `suspended`.
2. Stop using LTI placements; keep the professor-controlled Blackboard CSV fallback available.
3. Revoke/rotate tool signing key or Blackboard registration if compromise is suspected.
4. Revoke active launch sessions server-side.
5. Preserve audit/sync evidence under the institution retention/legal-hold policy.
6. Correct configuration/code through reviewed migration/PR; retest in non-production before returning to testing/active.
