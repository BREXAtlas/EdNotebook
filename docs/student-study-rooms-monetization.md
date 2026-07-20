# Student study rooms and sustainable pricing

Study rooms reuse the office-hours media stack. Students can create rooms only inside a class they can access. K–12 and university course boundaries remain separate because access is inherited from the course, not from a public room code.

## Free foundation

- Audio-only room for up to 6 people.
- Host or class-controlled screen sharing.
- Shared scratchpad up to 200 KB.
- 120 connected participant-minutes per account each month.
- No recording.
- A room closes after 15 minutes with no active participant.

The free allowance is enough to test real studying without making the core learning workflow paywalled. A participant-minute means one person connected for one minute, so a six-person room running for 30 minutes uses 180 participant-minutes.

## Paid additions coming soon

| Addition | Proposed price | What it changes |
|---|---:|---|
| Study Room Plus | $0.99 / month | 600 participant-minutes, 12 people, longer scratchpad history |
| Study Room Day Pass | $0.99 | 300 participant-minutes usable for 24 hours |
| Class Room Sponsor | $4.99 / month | Educator-funded pool for one class, 5,000 participant-minutes |
| Recording Pack | Not enabled | Do not sell until consent, retention, deletion, and storage controls are complete |

Pricing is a product proposal, not active billing. All paid buttons should continue to say “Coming soon” and lead to a waitlist until metering, refunds, and provider cost alerts are verified.

## Abuse and cost controls

- One active student-created room per account on the free tier.
- Class membership required for creation and joining.
- No anonymous room access.
- Rate limits on room creation and token issuance.
- Provider tokens expire after 10 minutes and are renewed only while the EdNotebook session remains valid.
- Screen-sharing permission is explicit per room; camera publishing is never granted.
- Voice messages, when added, use the private file pipeline with duration, type, size, quota, scan, and deletion controls.
- Scratchpad updates have bounded payloads and optimistic version numbers; a future realtime merge must preserve change history rather than silently overwrite concurrent work.

## Unit economics checkpoint

At LiveKit's July 19, 2026 Ship-plan overage price of $0.0005 per WebRTC participant-minute, 600 participant-minutes represent $0.30 in metered WebRTC overage before base plan, transfer, taxes, support, or recording. A $0.99 tier therefore needs monitoring but leaves room for payment fees only at careful scale. The safer launch sequence is included minutes → usage dashboards → sponsored class pool → individual paid add-on. Source: [LiveKit pricing](https://livekit.com/pricing).

## Success measures

- Percentage of linked students who join a room.
- Rooms that reach a second session in seven days.
- Average useful session length excluding abandoned joins.
- Course completion or assignment submission correlation, reported only in aggregate.
- Provider cost per weekly active room.
- Safety reports per 1,000 room-hours and time to resolution.
