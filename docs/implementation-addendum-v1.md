# Implementation Addendum v1 — Decision Gate Results

> Status: Ready for implementation handoff after D1–D3.  
> Date: 2026-06-12  
> Applies to: `docs/kiosk-operating-layer-prd.md` and `docs/kiosk-orchestrator-plan.md`  
> Source decision tasks: D1 `t_be7e4243`, D2 `t_14147a7e`, D3 `t_3de9aa09`

---

## 1. Executive decision summary

| Gate | Decision | Implementation effect |
|---|---|---|
| D1 — ORM/query builder | Use Drizzle ORM + `drizzle-kit` for both local SQLite and central PostgreSQL. | Implement service-owned schema modules, generated/reviewed SQL migrations, and explicit migration runners. |
| D2 — Hardware baseline | Build fake adapters first. Baseline real hardware is Linux Mint/Ubuntu-family, CH340 USB serial token input, and ICOD/PT80KM CUPS thermal printer. | Implement HAL/config seams now; keep physical-readiness claims gated on HQ evidence. |
| D3 — Ticket/package policy | Use per-kiosk HMAC-signed offline ticket codes; use SHA-256 package checksums for pilot and Ed25519-signed manifests before production. | Runtime signs tickets, packages never access secrets, central reconciles offline tickets idempotently. |

---

## 2. D1 resolved implementation rules — Drizzle

### Locked stack

- Local runtime database: SQLite + Drizzle schema modules.
- Central API database: PostgreSQL + Drizzle schema modules.
- Migration generation: `drizzle-kit generate`.
- Migration validation: `drizzle-kit check` plus test DB migration runs.
- Migration execution: service-owned TypeScript runners, not implicit service boot migration.

### Required root commands

```jsonc
{
  "scripts": {
    "db:generate:local": "drizzle-kit generate --config services/local-backend/drizzle.local.config.ts",
    "db:generate:central": "drizzle-kit generate --config services/central-api/drizzle.central.config.ts",
    "db:check:local": "drizzle-kit check --config services/local-backend/drizzle.local.config.ts",
    "db:check:central": "drizzle-kit check --config services/central-api/drizzle.central.config.ts",
    "db:migrate:local": "tsx services/local-backend/src/db/migrate-local.ts",
    "db:migrate:central": "tsx services/central-api/src/db/migrate-central.ts",
    "db:studio:local": "drizzle-kit studio --config services/local-backend/drizzle.local.config.ts",
    "db:studio:central": "drizzle-kit studio --config services/central-api/drizzle.central.config.ts"
  }
}
```

### Schema layout guardrails

- Keep local SQLite and central PostgreSQL schemas separate.
- Put shared IDs, envelopes, ticket payload types, command payloads, and heartbeat contracts in `packages/shared-types`.
- Commit generated SQL migrations with the schema change that produced them.
- Do not use `drizzle-kit push` for durable kiosk or central databases; reserve it for disposable prototypes only.
- Validate SQLite policy outside the ORM: WAL, foreign keys, busy timeout, explicit transactions, checkpointing, and backup/export before destructive migration.

---

## 3. D2 resolved implementation rules — hardware baseline

### Build immediately with fake adapters

Implementation cards may proceed with:

- HAL interfaces for token and printer adapters.
- Fake token adapter emitting normalized token events.
- Fake printer adapter emitting print request/result/failure events.
- Session FSM: idle → token received → game/session active → ticket generated → print requested → print result → reset.
- SQLite records for sessions, token events, tickets, print jobs/results, append-only events, and sync queue.
- Local REST/WebSocket diagnostics, test token, test print, and maintenance mode.
- Config contract for later real hardware modes.

### Real hardware baseline to support later

| Area | v1 baseline | Required implementation behavior |
|---|---|---|
| OS | Linux Mint 22.3 / Ubuntu LTS family | Use systemd/CUPS/udev-compatible deployment assumptions. |
| Kiosk path | `/home/yr/kiosk` on target documents | Keep install path configurable; do not hardcode across all kiosks without confirmation. |
| Token input | CH340 USB serial, USB ID `1a86:7523`, driver `ch341` | Prefer `/dev/serial/by-id/usb-1a86_USB_Serial-if00-port0`; make port, baud, framing, and debounce configurable. |
| Printer | ICOD/PT80KM CUPS thermal printer, queue `ICOD-PT80KM` or `PT80KM` | Implement CUPS adapter first; keep direct ESC/POS/raw as optional spike. |
| Print route | CUPS image print | Do not depend on unavailable HTTP print API. |
| Paper | Unknown; likely 80mm class but not confirmed | Ticket renderer must use configurable paper profile and not hardcode final dimensions. |
| Browser | Chromium-style fullscreen kiosk mode | Keep browser package/channel/flags configurable until target confirmation. |
| Supervision | systemd, Docker Compose where practical, Tailscale mandatory | Provide unit files/runbooks only after repo/tooling baseline exists. |

### Physical readiness gate

No implementation card may claim real hardware readiness until HQ/operator evidence confirms:

- `lsusb`, `dmesg`, `/dev/serial/by-id`, and permissions for CH340 serial input;
- raw token hex capture and normalized token event mapping;
- CUPS queue status and test print on ICOD/PT80KM;
- paper width/printable area/cutter/QR readability;
- browser kiosk boot, systemd restart, offline flow, Tailscale access, rollback, and monitoring evidence.

---

## 4. D3 resolved implementation rules — tickets, secrets, and packages

### Ticket code format

Final v1 display format:

```text
<campaign-short-code>-<kiosk-short-id>-<public-ticket-id>-<check>
```

Example:

```text
CHO-HQ001-01JABCDEF123-7K9P2Q
```

Rules:

- `ticket_id` remains a full local ULID in the database.
- `public-ticket-id` is 12 Crockford/base32-safe characters derived from the ticket id or a separate random public id.
- `check` is the first 6 Crockford/base32 characters of HMAC-SHA-256 over a canonical ticket payload for low-value pilot tickets.
- Use 10–12 check characters or online validation if JM raises redemption value/fraud risk.
- The local runtime, not the package, creates the final redeemable ticket code.

### Ticket signing secret

- Use one unique ticket-signing key per kiosk.
- Store pilot key material under `/etc/retail-kiosk/secrets/ticket-signing.env` or an equivalent systemd credential path.
- Required ownership/mode: `root:kiosk-runtime`, `0640`; directory `0750` or stricter.
- Never store ticket-signing secrets in packages, manifests, checked-in config, browser storage, logs, screenshots, or support bundles.
- Include `key_version`, HMAC algorithm, and check length in stored ticket records.

### Package validation

Pilot/HQ minimum:

- Manifest includes package id, version, minimum runtime/player versions, file list, file sizes, and SHA-256 digest for every shipped file.
- Runtime/agent validates every digest before staging and activation.
- Validation failure blocks activation, preserves previous known-good package, emits `package_validation_failed`, and reports the failure in heartbeat/sync.

Production minimum before broad rollout:

- Ed25519 signature over canonical package manifest and file digests.
- Public verification keys deployed through kiosk image or authenticated device-management channel.
- Private signing keys stay central/CI-side only.
- Signing key rotation and revocation process documented and tested.

### Redemption model

- First pilot default: `staff_visual_v1`.
- Printed ticket redemption must not require live central validation for the token → play → ticket → print path.
- Optional QR may encode the same ticket code or a central validation URL.
- Central reconciliation remains idempotent and append-only after offline upload.

---

## 5. Updated implementation gates

Implementation can begin only after this addendum is accepted as the handoff source for I1.

| Gate | Required evidence |
|---|---|
| I1 repo/tooling | `pnpm install`, `pnpm typecheck`, `pnpm test`, and `pnpm build` run against skeleton packages. |
| R1 tooling review | Reviewer confirms scripts, workspace paths, Node/pnpm versions, and no overbuilt dependencies. |
| I2 contracts/schema | Shared event/session/ticket/command/heartbeat/package contracts and package validator tests pass. |
| R2 contract review | Reviewer confirms contracts match PRD + this addendum. |
| I3 runtime core | SQLite migrations, Drizzle schema, event append, session state, ticket generation, and transaction tests pass. |
| R3 runtime review | Reviewer verifies local durability policy, migration safety, and ticket signing boundaries. |
| I4 fake hardware/API | Fake token → session and fake print result evidence exists through API/state/event logs. |
| Q1 fake runtime QA | Webtester verifies token → session → ticket → fake print → reset without real hardware. |
| I5 player/package sandbox | Browser smoke test passes and package iframe cannot call runtime directly. |
| Q2 player QA | Webtester verifies browser flow, console/network cleanliness, and reset behavior. |
| I6 central API/sync | PostgreSQL migrations, heartbeat, idempotent event ingest, and duplicate upload tests pass. |
| R4 central review | Reviewer verifies Drizzle migrations, idempotency constraints, and append-only event model. |
| I7 agent/commands | Heartbeat and command lifecycle work with allowlisted commands only; no arbitrary shell execution. |
| R5 command safety review | Reviewer verifies role/confirmation/evidence rules. |
| I8 dashboard | Dashboard shows seed/fake kiosk, queue length, last session, health, and command lifecycle. |
| Q3 dashboard QA | Webtester verifies dashboard workflows against seed/fake data. |
| I9 ops scaffold | systemd/browser/CUPS/Tailscale runbooks and service templates are reviewable. |
| O1 ops review | Reviewer confirms target OS assumptions are configurable and safe. |
| O0 physical evidence spike | HQ/operator evidence confirms serial, printer, paper, browser, service, offline, remote ops, and rollback checks. |
| I10 real hardware adapters | Serial/CUPS adapters remain behind HAL interfaces and are tested against O0 evidence or blocked. |
| Q4 physical HQ checklist | Real token → play → physical print → reset → reboot recovery evidence exists. |
| F1 final synthesis | Separates code-complete, fake-flow-complete, hardware-validated, and HQ-pilot-ready status. |

---

## 6. Orchestrator graph changes

Update `docs/kiosk-orchestrator-plan.md` before dispatching deeper implementation cards:

1. Make S1 the parent of all implementation cards, including I1, I6, I7, and I9, so D1–D3 results are always visible to implementers.
2. Add `O0 — Physical Hardware Evidence Spike` before `I10 — Real Hardware Adapters`.
3. Keep I10 and Q4 blocked until hardware evidence exists; fake-flow work must not wait on physical hardware.
4. Route Drizzle migration review into R1/R3/R4 rather than treating ORM choice as an open question.

---

## 7. Remaining blockers before I1 implementation

No unresolved blocker prevents I1 repo/tooling and fake-flow implementation.

Remaining non-I1 blockers:

- Physical hardware readiness remains unproven until O0/Q4 evidence is captured.
- Coin acceptor baud/framing/denomination mapping is unknown.
- Printer paper width/printable area/cutter/QR readability is unknown.
- Browser package/channel, display rotation, touch calibration, power management, and final target user/path require target confirmation.
- Higher-value redemption campaigns require explicit JM decisions on check length, central validation, duplicate handling, expiry strictness, and lost/cloned kiosk policy.
