# Decision D3: Ticket Signing and Package Validation Policy

Status: recommended / ready for PRD addendum
Date: 2026-06-12
Task: t_3de9aa09

## Scope and evidence

This decision resolves the v1 policy gaps for `docs/kiosk-operating-layer-prd.md` sections:

- A3 Offline Ticket Code Generation, Redemption, and Anti-Forgery, lines 1009-1044.
- Package validation, lines 241-253.
- Security requirements, lines 591-601.
- Deploy/rollback flow, lines 618-634.

Assumptions for this decision:

- v1 is a brand-activation pilot, not a high-value payment or POS-integrated coupon platform.
- Kiosks must continue token -> play -> ticket -> print while offline.
- The local runtime, not the downloadable activation package, creates final redeemable ticket codes.
- Campaign packages may propose prize/ticket content, but cannot choose the anti-forgery code or access secrets.

## Decision summary

Use local, per-kiosk HMAC-signed ticket codes for v1, with central reconciliation after offline periods. Use SHA-256 package checksums for the first HQ/pilot loop and Ed25519-signed package manifests before production rollout.

First pilot redemption should be staff visual validation of a printed ticket, optionally aided by QR display of the same code, not mandatory live central validation. If a campaign changes from low-value staff redemption to higher-value or fraud-sensitive redemption, JM must explicitly choose stricter redemption and signature rules before launch.

## 1. Ticket code format

Final v1 human-readable ticket code:

```text
<campaign-short-code>-<kiosk-short-id>-<public-ticket-id>-<check>
```

Example:

```text
CHO-HQ001-01JABCDEF123-7K9P2Q
```

Field policy:

| Field | Policy |
|---|---|
| `campaign-short-code` | 3-6 uppercase Crockford/base32-safe characters assigned in the campaign manifest, e.g. `CHO`. No spaces or ambiguous characters. |
| `kiosk-short-id` | Human support identifier, e.g. `HQ001`, mapped centrally to immutable `kiosk_id`. |
| `public-ticket-id` | 12 Crockford/base32-safe characters derived from the locally generated `ticket_id`/ULID or a separate random public id. The local DB still stores full `ticket_id` as a ULID. |
| `check` | First 6 Crockford/base32 characters of HMAC-SHA-256 over the canonical ticket payload. Six characters is enough to prevent casual forgery for low-value pilot tickets; use 10-12 for higher-value campaigns. |

Canonical HMAC payload, encoded with stable key order and no whitespace-dependent formatting:

```json
{
  "v": 1,
  "campaign_id": "...",
  "campaign_version": "...",
  "kiosk_id": "...",
  "kiosk_short_id": "HQ001",
  "ticket_id": "01J...FULL_ULID",
  "public_ticket_id": "01JABCDEF123",
  "issued_at": "ISO-8601 UTC",
  "expires_at": "ISO-8601 UTC or null",
  "prize_code": "...",
  "redemption_policy": "staff_visual_v1"
}
```

HMAC rule:

```text
check = crockford_base32(HMAC_SHA256(ticket_signing_key_vN, canonical_payload))[0:6]
```

The DB stores:

- full canonical payload or its stable JSON representation;
- full `ticket_id`;
- displayed `ticket_code`;
- `key_version`;
- HMAC algorithm and check length;
- print job id/status;
- sync/redemption state.

Do not log the ticket signing key or the raw HMAC digest. Logging the final printed ticket code is acceptable because it is printed for redemption and needed for support/reconciliation.

## 2. Local ticket-signing key and secret storage

Use one unique ticket signing key per kiosk, provisioned during enrollment. The local runtime can only sign tickets for its own kiosk.

Minimum pilot storage:

- Store under `/etc/retail-kiosk/secrets/ticket-signing.env` or equivalent systemd credential path.
- File owner/mode: `root:kiosk-runtime`, `0640`; directory `0750` or stricter.
- Load into the local runtime process via systemd `EnvironmentFile=` or, preferably for production, `LoadCredential=`/systemd credentials.
- Never store secrets in activation packages, campaign manifests, checked-in config, browser localStorage, logs, screenshots, or support bundles.
- Development/fake adapters may use an obvious non-production key only when `NODE_ENV`/runtime mode is explicitly non-production.

Production hardening before rollout beyond HQ/pilot:

- Derive or provision keys with an explicit `key_version`.
- Support central key revocation and rotation command.
- Central API must know which key version signed each ticket, either by storing encrypted per-kiosk secrets or deriving per-kiosk keys from a protected central master secret.
- Rotation must not invalidate already printed tickets until their configured expiry unless JM explicitly voids a campaign.
- If a kiosk is lost or cloned, central can mark future tickets from that kiosk/key version as suspect while preserving audit history for already synced records.

## 3. Package checksum/signature minimum

Pilot / HQ minimum:

- Each activation package includes a manifest with package id, version, minimum runtime/player version, file list, byte size, and SHA-256 digest for every shipped file.
- The local runtime/agent validates every digest before staging and before activation.
- Validation failure blocks activation, keeps the previous known-good package, logs `package_validation_failed`, and reports the failure in heartbeat/sync.
- Package contents may not contain secrets and may not request arbitrary OS/network/hardware access beyond the controlled kiosk bridge.

Production minimum:

- Add an Ed25519 signature over the canonical package manifest and all file digests.
- Public verification keys are shipped with the kiosk agent/runtime image or provisioned through an authenticated device-management channel.
- Private package-signing keys remain central/CI-side only and are never deployed to kiosks.
- Manifests include `signature_key_id`, `signed_at`, `signer`, and compatible runtime/player version range.
- Support signing key rotation and key revocation before broad fleet rollout.
- The deploy flow remains: download -> verify checksum/signature -> stage -> health check -> activate -> monitor -> promote or rollback.

Do not require package signatures to complete the first local fake-flow implementation if it would slow HQ validation; do require checksums from the first package-cache implementation so the later signature layer plugs into the same validation path.

## 4. Central reconciliation for offline tickets

Local runtime behavior while offline:

- Generate `ticket_id`, canonical payload, HMAC check, ticket code, print job, and append-only events in one transaction before printing when possible.
- If print fails, keep the ticket record and mark state `print_failed`; do not silently reuse the same code unless an explicit reprint policy records the reprint event.
- Preserve unsynced ticket/event records over logs and unused packages during disk pressure.

Central sync behavior:

- Upload tickets/events idempotently with uniqueness on `(kiosk_id, ticket_id)` and `ticket_code`.
- Central verifies the HMAC using the kiosk/key version and stores `verified`, `duplicate`, `invalid_signature`, `expired`, `voided`, or `suspect_kiosk` status.
- Central accepts late uploads from offline kiosks if the ticket was issued inside the campaign schedule, by an active kiosk/key at issuance time, and within campaign retention/expiry policy.
- Corrections are append-only events; do not rewrite away original ticket issuance or print-failure evidence.
- Redemption, if recorded centrally, is also idempotent and auditable with actor/source, timestamp, and validation mode.

Recommended lifecycle:

```text
created -> print_requested -> printing -> printed / print_failed -> synced -> verified -> redeemed / expired / voided / suspect
```

## 5. First pilot redemption model

Use `staff_visual_v1` for the first pilot unless JM changes the business value or fraud profile.

Pilot ticket content:

- campaign name / short code;
- kiosk short id;
- human-readable ticket code;
- prize/reward label;
- issue timestamp and optional expiry;
- simple staff instruction, e.g. "Staff: accept one valid printed ticket for this campaign; retain or mark after redemption.";
- optional QR containing the same ticket code or a central validation URL, but redemption must not depend on online scanning for v1.

What staff validates in v1:

- the ticket is physically printed by the kiosk and matches current campaign branding;
- prefix/kiosk code is expected for the location;
- code format/check segment looks valid enough for staff support;
- ticket is within visible date/expiry rules;
- staff marks/retains ticket if duplicate redemption risk matters.

Do not promise real-time fraud prevention in `staff_visual_v1`. It is acceptable for low-value brand activations where operational simplicity matters more than central POS-grade validation.

## 6. Open JM decisions if redemption value changes

JM must decide before launch if any campaign has higher redemption value, cash-equivalent value, strict inventory caps, retailer reimbursement, or meaningful fraud risk.

Decision options:

| Question | Default for first pilot | Stricter option if value/risk increases |
|---|---|---|
| Check length | 6 Crockford/base32 chars. | 10-12 chars or QR-only longer signature. |
| Redemption mode | Staff visual validation. | QR scan against central API before honoring ticket. |
| Offline redemption | Accept printed offline tickets under campaign rules. | Require online validation or preloaded offline redemption lists. |
| Duplicate handling | Staff marks/retains physical ticket; central reconciles later. | Central redemption lock with one-use status before benefit is granted. |
| Prize authority | Package proposes prize; runtime signs/logs ticket. | Runtime/central rules engine owns prize selection/inventory caps. |
| Expiry | Campaign-configured visible expiry, tolerant of offline sync delay. | Short expiry plus central validation required. |
| Lost/cloned kiosk | Revoke future tickets; reconcile prior printed tickets by event history. | Immediate campaign void/reissue policy and central-only validation. |

## Implementation acceptance criteria to hand to builders

1. Ticket code generator unit tests cover canonical payload stability, HMAC check reproducibility, ambiguous-character rejection, uniqueness, key versioning, and changed-payload invalidation.
2. Local DB writes ticket/event/print-request records transactionally and preserves full `ticket_id` even when the public code is shortened.
3. Activation package cache validates SHA-256 digests before activation and leaves previous known-good package active on failure.
4. Package validation emits explicit reason codes and heartbeat/sync evidence.
5. Central ingest enforces idempotency and recomputes/validates ticket HMAC by kiosk/key version.
6. Pilot ticket template supports staff visual redemption and optional QR without requiring online scan for the token -> play -> ticket path.
