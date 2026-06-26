# Admin campaign editor next-slice spec

Status: planning handoff, not implementation
Date: 2026-06-26
Source snapshot: git `d93802c1ba39635ed5793a42ed3fcb17ef0f5c04` on branch `dow-i11-campaign-schema`, inspected at 2026-06-26T14:10:51Z
Scope: future central admin editor slice for campaign quiz copy, outcomes, ticket templates, and visual wheel mapping. This card intentionally does not implement code.

## Evidence base

Code and docs inspected:

- `AGENTS.md`
- `services/local-backend/src/server.ts`
- `services/local-backend/test/local-api.test.mjs`
- `apps/admin-dashboard/README.md`
- `docs/admin-dashboard.md`
- `docs/admin-auth-decision.md`
- `docs/plans/2026-06-22-central-back-office-control-plane.md`
- `docs/plans/2026-06-26-central-back-office-next-slice.md`
- `packages/campaign-schema/src/manifest.ts`
- `packages/campaign-schema/test/manifest.test.mjs`
- `campaigns/dr-oetker-pizza-wheel/README.md`
- `campaigns/dr-oetker-pizza-wheel/manifest.json`
- `campaigns/dr-oetker-pizza-wheel/campaign.json`

Current implemented boundary:

- Local campaign preview is read-only. `activeCampaignPreview()` reports `access.surface = local-admin-preview`, `intended_roles = ['superadmin', 'campaign-owner']`, `editing_supported = false`, `store_operator_editing = disabled-read-only-v1`, and a boundary note that production auth, central permissions, and store operator editing are not implemented.
- The campaign schema already models bilingual `fr-BE`/`nl-BE` quiz copy, outcomes, ticket template references, bitmap asset references, QR payload templates, cashier instructions, terms, and visual wheel segments.
- Central back-office planning already gates mutation-heavy work behind central auth, role middleware, and audit.

Assumptions:

- This editor is a central back-office feature, not a kiosk-local feature.
- Kiosks remain local-first: published campaign versions are staged and cached centrally/locally, but token/play/print keep working offline from the currently active local package.
- `LOCAL_BACKEND_AUTH_TOKEN` remains a service/local control token, not human editor authorization.
- Ticket/template edits must never mutate historical ticket rows; each produced ticket snapshots the template/version/render payload it used.
- Printer-safe bitmap upload/processing may be a separate slice, but the editor must expose only processed/approved asset references for activation.

Confidence: high for current read-only state and manifest fields from code inspection; medium for implementation sequencing because final schema shape depends on whether campaign packages, template versions, and assets are modeled in one table family or split by domain.

## Goal

Add a central, authenticated, audited campaign editor slice that lets authorized HQ/admin users create a draft revision from an existing campaign package, edit campaign content/rules within safe bounds, validate it with existing package/schema rules, preview/test it, and publish a versioned revision to the deployment/schedule pipeline.

The first implementation should be narrow: editing content and mapping fields already represented by the campaign schema, not arbitrary module code, not direct kiosk mutation, and not store-operator self-service.

## Role and permission boundary

| Role | Campaign editor access | Notes |
|---|---|---|
| `viewer` | Read campaign list, active version, published history, validation status, and preview screenshots/JSON. | No draft creation, no save, no publish. |
| `operator` | Read plus run explicit preview/test-print actions only when a draft is already prepared by an admin and the action is marked HQ/test. | No content edits. No activation. Useful for HQ smoke evidence. |
| `admin` | Create/edit drafts, upload/select already processed assets when the asset slice exists, submit validation, request test print, and publish after required gates pass. | Main role for Acmea/HQ campaign owners. All writes audited. |
| `superadmin` | Admin rights plus override/archive disabled drafts, manage editor roles, emergency unpublish/rollback when deployment slice supports it. | Break-glass only; still audited with reason. |
| Store operator | No central campaign editor access in v1. | Store users may monitor kiosk health or perform approved on-site operational steps in another slice, but cannot edit campaign copy, weights, tickets, assets, QR payloads, or wheel maps. |

Policy rules:

1. Deny by default. Every editor route declares a minimum role.
2. All write attempts, including denied attempts, create audit records with actor, action, subject, request ID, and safe metadata.
3. Publishing requires `admin` or `superadmin`, a validation pass, a publish note, and an idempotency key.
4. Test print actions create test/evidence tickets only; they must not be redeemable customer tickets and must be marked as test in logs/audit.
5. Central editor roles do not grant kiosk/service credentials. Kiosk heartbeats, event uploads, and command polling remain device/service-authenticated.

## Editable fields for the first slice

The first editor should operate on a typed `CampaignEditorDraft` that maps to the package manifest/campaign config fields below. Preserve both locales everywhere required by the schema.

### Campaign metadata

Editable:

- `display_name` / `name`
- `campaign_short_code` only while draft has never been published and if uniqueness validation passes
- `defaultLocale` limited to supported locales
- `supportedLocales` fixed to `fr-BE` and `nl-BE` for this Belgian wheel slice unless the schema is intentionally expanded later
- draft status/note fields internal to central admin

Not editable in this slice:

- `package_id` identity of an active package
- `runtime_contract_version`, `min_runtime_version`, `min_player_version`
- `entrypoint` and executable module files
- package signature/checksum fields except as system-generated output after publish/package build

### Quiz copy

Editable:

- `quiz.question.fr-BE` and `quiz.question.nl-BE`
- exactly three choice labels in both locales
- which one choice is correct
- `quiz.attempt_limit` within a conservative range, default 2; recommended v1 range 1-3
- `quiz.retry_copy` and `quiz.failed_copy` in both locales

Validation:

- Both `fr-BE` and `nl-BE` strings are required and non-empty.
- Exactly three choices for this wheel template.
- Exactly one correct answer.
- Choice IDs remain stable for published drafts; new drafts may add generated IDs but cannot collide.
- Quiz-gated spins remain backend-authoritative: passing the quiz unlocks the backend session state, not frontend-only state.

### Outcomes / prize rules

Editable:

- Outcome localized label in both locales.
- `outcome_type` from existing allowed schema values: `win`, `loss`, `consolation`, `grand_prize`, `custom`.
- `active` flag, with at least one active printable or visible outcome required.
- `weight`, with non-negative integer weights and at least one positive active weight.
- `daily_cap` / `inventory_cap` where available.
- `print_ticket` flag.
- `ticket_template_id` selected from draft ticket templates when `print_ticket = true`.
- `bitmap_asset_id` selected from approved/processed assets when present.
- `qr_payload_template` or `approved_qr_payload_equivalent` for printable/redeemable tickets.
- `cashier_instruction` and `terms` in both locales.

Validation:

- `outcome_strategy.authority` remains `local_backend`.
- `outcome_strategy.offline_required` remains `true`.
- `outcome_strategy.selection` remains `weighted_random` for this slice.
- Printable outcomes require a valid template reference.
- QR payload templates should include `{{ticket_code}}` unless an explicit approved equivalent reason is recorded.
- Weights/caps are validated as business rules and displayed with expected distribution totals before publish.
- Outcome IDs are immutable for already-published outcomes; retiring is by `active = false` plus new version, not mutation of history.

### Ticket templates

Editable:

- Template display name/internal note.
- FR/NL header/body/cashier/terms copy represented in the central template draft model.
- QR payload template associated with the template or outcome.
- Processed bitmap asset selector once asset upload/processing exists.
- Template status: draft, active, archived.

Validation:

- Every template activation creates a new immutable version.
- Ticket rows snapshot `template_id`, `template_version`, `asset_version`, `qr_payload_template` or approved equivalent, and full render payload at ticket creation time.
- Preview rendering must use the same renderer contract as production print rendering as far as possible.
- Test print is explicit, audited, and marked non-redeemable.
- Historical tickets are never re-rendered with the new draft.

### Visual wheel map

Editable:

- Ordered `visual_wheel.segments` list.
- `segment_id` for new segments, generated by the system or stable user-friendly slug field.
- `outcome_id` mapping for each segment.
- Optional `bitmap_asset_id` from approved wheel assets.
- Optional localized segment label in both locales.

Validation:

- Each segment maps to an existing active or intentionally visible outcome.
- Segment count stays within template limits; recommend v1 min 3, max 12 unless player rendering tests prove more.
- The map must include every active outcome that can be selected, or the draft must record an explicit reason why an outcome is backend-selectable but not visible.
- Wheel segment labels must not be the source of outcome truth; backend outcome selection remains authoritative and the player animates to a segment mapped to that outcome.

## Validation and publish workflow

Recommended draft state machine:

```text
published package/version
  -> create draft revision
  -> editing
  -> validation_failed | validation_passed
  -> preview_ready
  -> test_print_requested/test_print_succeeded (optional gate for non-printing changes, required for ticket/bitmap changes)
  -> publish_pending
  -> published
  -> deployed/staged by schedule/deployment slice
  -> archived/rolled_back by later slice
```

Minimum workflow:

1. Admin creates a draft from the currently active campaign package/version.
2. UI edits are saved as a central draft, not written to kiosk-local files.
3. Server validates draft on every save enough to return field errors, and validates fully before `submit-validation`/publish.
4. Validation runs the same campaign-schema contract used by `pnpm package:validate`, plus central business rules:
   - bilingual copy complete;
   - outcome/template/asset references resolve;
   - backend-authoritative outcome strategy preserved;
   - no historical ticket mutation;
   - QR/test-ticket constraints satisfied;
   - package/module executable files unchanged in content-only slice.
5. Preview endpoint returns normalized manifest/config JSON and a render preview payload for admin UI. It must not mark draft active.
6. If ticket templates, QR payload, or bitmap assets changed, require preview and test print evidence before publish.
7. Publish creates a new immutable `campaign_version`/`package_revision` and audit record. It does not directly mutate live kiosk state.
8. Deployment/schedule slice stages the new version to target kiosks and activates it at `next-safe-boundary` or scheduled time.
9. Kiosk local runtime keeps the previous known-good package until the staged version has validated and activated successfully.

## Suggested central API shape

Names are proposed for the future coder card; adjust to local route conventions during implementation.

Read routes, `viewer+`:

- `GET /v1/admin/campaigns`
- `GET /v1/admin/campaigns/:campaignId`
- `GET /v1/admin/campaigns/:campaignId/versions`
- `GET /v1/admin/campaign-drafts/:draftId`
- `GET /v1/admin/campaign-drafts/:draftId/validation`

Write routes, `admin+` unless noted:

- `POST /v1/admin/campaigns/:campaignId/drafts` — create from active/published version.
- `PATCH /v1/admin/campaign-drafts/:draftId/metadata`
- `PATCH /v1/admin/campaign-drafts/:draftId/quiz`
- `PATCH /v1/admin/campaign-drafts/:draftId/outcomes`
- `PATCH /v1/admin/campaign-drafts/:draftId/ticket-templates`
- `PATCH /v1/admin/campaign-drafts/:draftId/visual-wheel`
- `POST /v1/admin/campaign-drafts/:draftId/validate`
- `POST /v1/admin/campaign-drafts/:draftId/preview`
- `POST /v1/admin/campaign-drafts/:draftId/test-print` — `operator+` may run only after admin-created draft reaches preview-ready.
- `POST /v1/admin/campaign-drafts/:draftId/publish`
- `POST /v1/admin/campaign-drafts/:draftId/archive`

Route requirements:

- Require admin session cookie and CSRF/idempotency protection according to the auth implementation.
- Every write route accepts `If-Match` or a draft revision token to prevent lost updates.
- Every publish/test-print route accepts an explicit confirmation/publish note.
- Never return secrets, raw signing keys, or full unreconciled ticket codes in error/audit metadata.

## Suggested central data model

This can be implemented in Drizzle/PostgreSQL after auth and audit land.

Minimum tables or equivalent:

- `campaigns`: stable campaign identity, slug, display name, owner, status.
- `campaign_versions`: immutable published versions with manifest/config JSON, schema version, semantic version/revision, created_by, created_at, source draft, checksum/signature metadata, status.
- `campaign_drafts`: mutable draft JSON, base version, status, validation summary, created_by, updated_by, revision token, publish note.
- `campaign_draft_validations`: validation run ID, draft revision, result, errors, warnings, created_at.
- `campaign_draft_previews`: preview run ID, draft revision, render payload, optional artifact path/checksum.
- `ticket_templates` / `ticket_template_versions`: if not merged into campaign versions, immutable template version records with locale payload, asset references, QR template, status.
- `campaign_assets` / `asset_versions`: uploaded and processed asset metadata, checksums, MIME type, dimensions, approval/processing status.
- `admin_audit_log` or extended `audit_log`: actor-linked writes and denied attempts.

Indexing priorities:

- `campaign_id`, `status`, `updated_at` on drafts.
- `campaign_id`, `version`, `published_at` on versions.
- `draft_id`, `revision` on validation/preview rows.
- `actor_user_id`, `action`, `occurred_at` on audit.

## UI handoff

Add a central-only campaign editor under the admin dashboard's central back-office mode. Keep local admin preview read-only.

Suggested screens:

1. Campaign list/version history: active version, draft count, validation state, last published by/at.
2. Draft editor with tabs:
   - Overview/copy metadata.
   - Quiz copy.
   - Outcomes and weights/caps.
   - Ticket templates and QR/test-print preview.
   - Wheel map.
   - Validation/publish checklist.
3. Diff/preview panel comparing active version vs draft.
4. Publish dialog with confirmation, target deployment handoff, and audit note.

UX rules:

- Keep labels compact; surface field help only where it prevents an operational mistake.
- Show bilingual completeness inline.
- Show all publish blockers in one checklist.
- Make store-operator non-access explicit only in admin/permission docs; do not clutter normal editor UI with repeated warnings.
- Empty states must say when a feature is not implemented rather than showing demo rows.

## Future coder task boundaries

Recommended implementation order:

1. Prerequisite card: central auth/roles/audit foundation from `docs/admin-auth-decision.md` and `docs/plans/2026-06-26-central-back-office-next-slice.md` B3.
2. Editor data/API card: campaign/draft/version tables, repository methods, editor routes, validation service, audit wiring, tests.
3. Editor UI card: central campaign list, draft editor, validation/preview/publish panels, smoke tests.
4. Ticket/asset integration card: template versioning, bitmap upload/processing, test print evidence if not already done.
5. Deployment handoff card: publish-to-schedule/deployment pipeline with safe-boundary activation and rollback evidence.

Do not combine these with arbitrary module code upload or live kiosk deployment execution in the first editor card.

## Acceptance criteria for the future editor API card

- Unauthenticated requests to all campaign editor read/write routes are rejected except public health/login routes.
- `viewer` can read campaign versions/drafts but cannot create/edit/publish.
- `operator` cannot edit content and can only run allowed test-print/preview actions under the documented conditions.
- `admin` can create a draft, edit quiz/outcomes/ticket/wheel fields, validate, preview, and publish a new version.
- Store operators have no campaign editor route permission in v1.
- Validation rejects incomplete bilingual quiz copy, invalid correct-answer count, invalid outcome/template/asset references, missing QR ticket-code template without approved equivalent, and frontend-owned/offline-unsafe outcome authority.
- Publish creates an immutable version and audit row; it does not directly edit local kiosk files or active sessions.
- Existing ticket rows keep their original template/version/render payload after a new template/campaign version is published.
- Tests cover role denial, draft lost-update protection, validation failures, successful publish, and audit records.

## Acceptance criteria for the future editor UI card

- Central admin mode shows campaign versions and draft status from central API data only.
- Local `/admin/api/campaign-preview` remains read-only and still reports `editing_supported: false`.
- UI supports editing both `fr-BE` and `nl-BE` fields for quiz/outcome/ticket/wheel labels.
- Validation errors are shown beside fields and summarized before publish.
- Publish and test print require explicit confirmation and do not present test tickets as customer tickets.
- Smoke tests cover viewer read-only state, admin draft edit path, validation failure display, and no fake/demo central campaign rows.

## Explicit non-goals

- No store-operator campaign editing in v1.
- No kiosk-local editing of campaign packages from `/admin`; local admin stays fallback/debug/read-only for campaign content.
- No arbitrary HTML/JS/module file editing or upload in this content editor slice.
- No direct mutation of live kiosk state on publish; activation belongs to the schedule/deployment command lifecycle.
- No customer/player identity changes.
- No casino/payment framing; this remains a promotional high-win brand activation unless a separate compliance project is opened.
- No production auth claim from `LOCAL_BACKEND_AUTH_TOKEN`, fake dev routes, or local SQLite fallback.
- No historical ticket re-rendering or retroactive modification of redeemed/printed tickets.
- No unprocessed bitmap/logo activation; images must pass the asset-processing slice before use in printable tickets.

## Risks and controls

| Risk | Control |
|---|---|
| Central writes ship before auth/roles/audit | Make B3 auth/audit a hard dependency for write routes; tests reject unauthenticated/underprivileged users. |
| Store staff accidentally change campaign economics/copy | No store-operator role in editor; route-level denial and no UI entry point. |
| Published draft breaks offline kiosk play | Preserve `local_backend` authority, schema validation, package checksum/signature, staging, and previous known-good rollback. |
| Ticket/legal copy changes alter historical evidence | Immutable versions and per-ticket render snapshots. |
| Bad QR template creates unredeemable tickets | Require `{{ticket_code}}` or recorded approved equivalent; preview/test-print gate. |
| Wheel map diverges from backend outcomes | Validate every selectable active outcome has a visible mapping or explicit exception. |
| Fake editor confidence from demo rows | Central UI must use live central API data and explicit not-implemented/empty states. |

## DOX closeout

This planning artifact lives under `docs/plans/` and does not change runtime contracts, source APIs, ownership, repository structure, or operating rules. The root `AGENTS.md` already owns `docs/` in the Child DOX Index, and there is no child `AGENTS.md` under `docs/` or `docs/plans/`; no AGENTS.md update is required for this spec-only handoff.
