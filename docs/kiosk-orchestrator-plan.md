# Kiosk Operating Layer — Orchestrator Plan

> **Status:** Updated after D1–D3; S1 implementation addendum ready for implementation handoff.  
> **Source PRD:** `/home/ubuntu/projects/retail-kiosk-activation/docs/kiosk-operating-layer-prd.md`  
> **Implementation addendum:** `/home/ubuntu/projects/retail-kiosk-activation/docs/implementation-addendum-v1.md`  
> **Reviewed by:** architecture agent + developer agent  
> **Review result:** Approved for orchestrator/Kanban planning; implementation cards must use S1 addendum as the resolved-decision overlay.

---

## 1. Available Profiles Discovered

`hermes profile list` confirmed these usable profiles:

| Profile | Intended use in this plan |
|---|---|
| `orchestrator` | Root coordinator; creates/links child cards; does not implement. |
| `researcher` | Research/decision cards: ORM choice, hardware validation, package signing details. |
| `analyst` | Architecture/spec synthesis, trade-off analysis, acceptance criteria. |
| `coder` | Implementation cards: repo/tooling, local runtime, API, player, agent. |
| `roger` | Code/architecture review gates. |
| `webtester` | Browser/player/admin QA and E2E verification. |
| `ops` | Device/systemd/Tailscale/deployment/hardware operations. |
| `scribe` | Documentation, runbooks, changelog, PRD updates. |
| `sketcher` | Optional UI/UX visual design after operational flow is stable. |
| `growth` | Not needed for technical MVP; later campaign analytics/brand reporting. |

---

## 2. Orchestrator Operating Rule

The root `orchestrator` card must not implement directly.

It must:

1. Read the source PRD.
2. Confirm repo/workspace path before creating implementation cards.
3. Resolve early decisions before dependent work starts.
4. Create cards in dependency order.
5. Assign only to discovered profiles.
6. Require review gates before moving deeper.
7. Keep implementation blocked until JM approves this plan.

---

## 3. Proposed Board

Recommended board slug:

```text
retail-kiosk-activation
```

Reason: this board already exists and matches the canonical project/repo. Avoid creating a parallel `kiosk-operating-layer` board that would split history.

Recommended root card title:

```text
ORCH: Kiosk operating layer MVP from reviewed PRD
```

Root card body should include:

- canonical PRD path: `/home/ubuntu/projects/retail-kiosk-activation/docs/kiosk-operating-layer-prd.md`;
- implementation addendum path: `/home/ubuntu/projects/retail-kiosk-activation/docs/implementation-addendum-v1.md`;
- this orchestrator plan path: `/home/ubuntu/projects/retail-kiosk-activation/docs/kiosk-orchestrator-plan.md`;
- “no implementation before JM approval” constraint;
- architecture/developer review results;
- profile list;
- task graph below;
- acceptance gates.

---

## 4. Task Graph Overview

```text
T0 ORCH root
  ├── D1 Decide ORM/query builder
  ├── D2 Confirm hardware baseline
  ├── D3 Define ticket/signing/package key policy
  ├── S1 Final implementation spec addendum
  │
  ├── I1 Repo/tooling skeleton
  │     └── R1 Review repo/tooling
  │
  ├── I2 Shared contracts + campaign schema
  │     └── R2 Review contracts/schema
  │
  ├── I3 Local runtime persistence/session/event/ticket core
  │     └── R3 Review local runtime core
  │
  ├── I4 Fake hardware + local API/WebSocket
  │     └── Q1 Fake token → session → ticket → fake print → reset QA
  │
  ├── I5 Kiosk player fake flow + sandboxed package iframe
  │     └── Q2 Player E2E/browser QA
  │
  ├── I6 Central API + PostgreSQL + idempotent event ingest
  │     └── R4 Review central sync/API
  │
  ├── I7 Kiosk agent heartbeat + command lifecycle
  │     └── R5 Review agent/command safety
  │
  ├── I8 Admin dashboard v1
  │     └── Q3 Dashboard QA
  │
  ├── I9 Device/systemd/kiosk-mode deployment scaffold
  │     └── O1 Ops review
  │           └── O0 Physical hardware evidence spike
  │
  ├── I10 Real hardware adapters
  │     └── Q4 Physical HQ hardware checklist
  │
  └── F1 Final synthesis + HQ pilot go/no-go
```

---

## 5. Detailed Card Plan

## T0 — Root Orchestrator

- **Assignee:** `orchestrator`
- **Status after creation:** blocked until JM approves this plan.
- **Objective:** coordinate the full kiosk operating layer MVP from reviewed PRD.
- **Inputs:** PRD + orchestrator plan.
- **Output:** child cards, dependencies, board hygiene, final synthesis.

---

## Decision Cards — must run before dependent implementation

### D1 — Decide Drizzle vs Kysely

- **Assignee:** `researcher`
- **Parents:** T0 after approval.
- **Objective:** choose typed SQL/migration approach for SQLite + PostgreSQL.
- **Acceptance:** short recommendation with migration commands and why.
- **Default recommendation:** Drizzle if we want schema/type generation speed; Kysely if we want SQL-first clarity. Decision must be explicit before code.

### D2 — Confirm Hardware Baseline

- **Assignee:** `ops`
- **Objective:** verify actual target OS, token acceptor, serial adapter, printer model, connection mode, paper width, CUPS/ESC/POS feasibility, udev needs.
- **Acceptance:** hardware facts table and blockers.

### D3 — Define Key/Ticket/Package Signing Policy

- **Assignee:** `analyst`
- **Objective:** lock v1 HMAC ticket code policy and package checksum/signature minimum.
- **Acceptance:** concrete key storage, ticket format, validation/reconciliation, package validation policy.

### S1 — Final Developer Spec Addendum

- **Assignee:** `scribe`
- **Parents:** D1, D2, D3.
- **Objective:** patch PRD or create an implementation addendum with resolved decisions.
- **Acceptance:** documented decisions and updated acceptance gates.

---

## Implementation Lane 1 — Repository and Contracts

### I1 — Repo/Tooling Skeleton

- **Assignee:** `coder`
- **Parents:** S1.
- **Objective:** create monorepo skeleton and CI baseline only.
- **Files:** root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, lint/test/build config, CI workflow, Drizzle root scripts from S1 addendum.
- **Acceptance:** `pnpm install`, `pnpm typecheck`, `pnpm test`, `pnpm build` run with empty/skeleton packages.

### R1 — Review Repo/Tooling

- **Assignee:** `roger`
- **Parents:** I1.
- **Objective:** verify tooling is clean, minimal, and not overbuilt.

### I2 — Shared Contracts + Campaign Schema

- **Assignee:** `coder`
- **Parents:** R1.
- **Objective:** implement shared TypeScript contracts and package manifest schema/validator.
- **Acceptance:** package schema tests pass; manifest fixture validates/fails correctly.

### R2 — Review Contracts/Schema

- **Assignee:** `roger`
- **Parents:** I2.
- **Objective:** verify contracts match PRD and are stable enough for parallel work.

---

## Implementation Lane 2 — Local Runtime and Player

### I3 — Local Runtime Core

- **Assignee:** `coder`
- **Parents:** R2.
- **Objective:** SQLite migrations, event append, sessions, tickets, print jobs, sync queue skeleton.
- **Acceptance:** unit tests for transactions, event append, ticket creation, state transitions.

### R3 — Review Runtime Core

- **Assignee:** `roger`
- **Parents:** I3.

### I4 — Fake Hardware + Local API/WebSocket

- **Assignee:** `coder`
- **Parents:** R3.
- **Objective:** fake token/printer adapters, local auth, runtime routes, WebSocket state updates.
- **Acceptance:** fake token starts session, fake print creates print result, events logged.

### Q1 — Runtime Fake Flow QA

- **Assignee:** `webtester`
- **Parents:** I4.
- **Objective:** verify fake token → session → ticket → fake print → reset through API/state evidence.

### I5 — Kiosk Player Fake Flow + Package Sandbox

- **Assignee:** `coder`
- **Parents:** I4, R2.
- **Objective:** React/Vite player, idle/session/result/maintenance screens, iframe package bridge.
- **Acceptance:** browser smoke test passes; package cannot call runtime directly.

### Q2 — Player E2E QA

- **Assignee:** `webtester`
- **Parents:** I5, Q1.
- **Objective:** full browser flow QA and console/network check.

---

## Implementation Lane 3 — Central API, Sync, Agent, Dashboard

### I6 — Central API + Event Ingest

- **Assignee:** `coder`
- **Parents:** R2, S1.
- **Objective:** PostgreSQL Drizzle migrations, heartbeat, idempotent event batch ingest, command routes skeleton.
- **Acceptance:** duplicate event upload is idempotent; heartbeat stored.

### R4 — Review Central API/Sync

- **Assignee:** `roger`
- **Parents:** I6.

### I7 — Kiosk Agent Heartbeat + Commands

- **Assignee:** `coder`
- **Parents:** I6, S1.
- **Objective:** identity, heartbeat, command polling, command safety allowlist, result reporting, and ticket/package policy integration points from S1.
- **Acceptance:** fake command lifecycle works; no arbitrary shell execution.

### R5 — Review Agent/Command Safety

- **Assignee:** `roger`
- **Parents:** I7.

### I8 — Admin Dashboard v1

- **Assignee:** `coder`
- **Parents:** I6, I7.
- **Objective:** fleet overview, kiosk detail, queue length, last session, command status, test print action.
- **Acceptance:** dashboard shows seed/fake kiosk and command lifecycle.

### Q3 — Dashboard QA

- **Assignee:** `webtester`
- **Parents:** I8.

---

## Implementation Lane 4 — Device Ops and Real Hardware

### I9 — Device/systemd/Kiosk Mode Scaffold

- **Assignee:** `ops`
- **Parents:** I1, S1.
- **Objective:** systemd units, Chromium kiosk launch, log paths, Tailscale notes, health checks, and configurable CH340/CUPS assumptions from S1.
- **Acceptance:** runbook can boot services on target Linux environment.

### O1 — Ops Review

- **Assignee:** `roger` or `ops` self-review plus `roger` audit if code/config changes.
- **Parents:** I9.

### O0 — Physical Hardware Evidence Spike

- **Assignee:** `ops`
- **Parents:** O1.
- **Objective:** capture HQ/operator evidence before real hardware adapter claims: serial detection, token raw hex, CUPS queue/test print, paper profile, kiosk browser boot, service restart, offline flow, Tailscale, rollback, and monitoring.
- **Acceptance:** evidence bundle or documented blocker; if hardware is unavailable, block I10/Q4 rather than guessing.

### I10 — Real Hardware Adapters

- **Assignee:** `coder`
- **Parents:** I4, O0.
- **Objective:** Serial token adapter and CUPS printer adapter behind existing interfaces; keep direct ESC/POS/raw as optional spike unless O0 proves it is required.
- **Acceptance:** hardware-specific tests or documented hardware-in-loop evidence.

### Q4 — Physical HQ Hardware Checklist

- **Assignee:** `webtester` plus `ops` evidence.
- **Parents:** I10, I5.
- **Objective:** real token → play → physical print → reset → reboot recovery.
- **Note:** only dispatch when hardware is physically available.

---

## Final Gate

### F1 — Final Synthesis + HQ Pilot Go/No-Go

- **Assignee:** `analyst`
- **Parents:** Q2, R4, R5, Q3, Q4 or documented hardware deferral.
- **Objective:** summarize evidence, blockers, risk, and go/no-go recommendation.
- **Output:** concise executive report for JM.

---

## 6. Required Board Guards

The orchestrator card must include these rules:

1. No implementation before JM approves this plan.
2. No UI polish before fake hardware E2E passes.
3. No real hardware adapter card before O0 physical hardware evidence is captured or explicitly blocked.
4. No direct package execution outside sandboxed iframe.
5. No central sync dependency in customer session flow.
6. No arbitrary shell command remote execution.
7. Every implementation card must report real command/test output.
8. Every review card must approve or create a concrete fixer card.
9. Failed review becomes a fixer/re-review loop, not a vague blocked state.
10. Final synthesis must separate “Kanban done” from “HQ pilot ready.”

---

## 7. Proposed First Kanban Action After JM Approval

After JM approves this plan, use the existing project board and create only the blocked root card first:

```text
Board: retail-kiosk-activation
Root: ORCH: Kiosk operating layer MVP from reviewed PRD
Assignee: orchestrator
Workspace: dir:/home/ubuntu/projects/retail-kiosk-activation
Status: blocked until explicit approval to fan out
```

Then, when JM says “proceed,” unblock the root. The orchestrator creates D1–D3 and S1 first, then proceeds according to dependencies.

D1–D3 and S1 have now produced decision artifacts. Deeper implementation cards should use `docs/implementation-addendum-v1.md` as required input, and real hardware work should include the new O0 physical evidence spike before I10/Q4.

---

## 8. Current Recommendation

This plan is ready for implementation-card creation after JM approval and should be read together with `docs/implementation-addendum-v1.md`.

I recommend proceeding with I1/R1 and fake-flow implementation cards once approved. Do **not** dispatch I10/Q4 until O0 captures physical hardware evidence or records a concrete hardware blocker.
