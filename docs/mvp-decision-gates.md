# MVP Decision Gates — Kiosk Operating Layer

> Source of truth: `docs/kiosk-operating-layer-prd.md`
> Compared with: `docs/kiosk-orchestrator-plan.md`
> Task: extract unresolved decisions before MVP implementation proceeds.
> Scope note: this is a decision-gate report only; no feature code was changed.

---

## Command evidence

Executed from the canonical workspace:

```text
$ pwd && git branch --show-current && git rev-parse HEAD && git status --short && test -f docs/kiosk-operating-layer-prd.md && test -f docs/kiosk-orchestrator-plan.md && printf 'canonical docs present\n'
/home/ubuntu/projects/retail-kiosk-activation
dow-i11-campaign-schema
bc2a45147596bb80f12d02991ade3ff9dc40eecd
canonical docs present
```

Read-size evidence:

```text
$ python3 - <<'PY'
from pathlib import Path
for p in ['docs/kiosk-operating-layer-prd.md','docs/kiosk-orchestrator-plan.md']:
    text=Path(p).read_text()
    print(f'{p}: {len(text.splitlines())} lines, {len(text)} bytes')
PY
docs/kiosk-operating-layer-prd.md: 1534 lines, 43434 bytes
docs/kiosk-orchestrator-plan.md: 363 lines, 12819 bytes
```

Also read for resolved-decision context because both canonical files reference it:

- `docs/implementation-addendum-v1.md` — referenced by PRD lines 906-913 and orchestrator plan lines 3-7, 355-363.

---

## Bottom line

MVP work is not blocked uniformly.

- Fake-flow implementation can begin after JM accepts the reviewed plan/addendum.
- Real hardware readiness, production rollout, and higher-value redemption remain gated.
- The orchestrator plan already converted D1-D3 into resolved decisions, but it still leaves operational decision gates that must become owner-visible cards before deeper MVP/HQ claims.

Evidence:

- PRD lines 902-913: architecture/developer reviews are complete, D1-D3 are resolved in `docs/implementation-addendum-v1.md`, and no implementation should start until PRD + plan + addendum are accepted.
- Orchestrator plan lines 328-337: board guards include no implementation before JM approval, no UI polish before fake E2E, no real hardware adapters before O0 evidence, and final synthesis must separate Kanban done from HQ pilot ready.
- Addendum lines 194-205: no blocker prevents I1/fake-flow work, but physical hardware, coin acceptor details, printer paper/cutter/QR, browser/display, and higher-value redemption remain unresolved.

---

## Resolved assumptions — do not reopen unless JM changes constraints

| Area | Resolved assumption | Evidence |
|---|---|---|
| Sync engine | Use custom SQLite outbox/event sync, not PowerSync/Electric/Replicache as v1 critical runtime sync. | PRD lines 29-32, 390-399 |
| Runtime authority | Browser/player never owns printer/serial authority; local runtime owns hardware and session state. | PRD lines 99-116, 178-183, 257-270 |
| Package sandbox | Activation packages run in sandboxed iframe with validated bridge messages. | PRD lines 919-950 |
| ORM/migrations | Use Drizzle ORM + `drizzle-kit`; generated/reviewed migrations and service-owned runners. | Addendum lines 12-16, 20-54 |
| Fake hardware first | Start with fake token/printer flow and HAL seams before real hardware claims. | Addendum lines 57-70; orchestrator plan lines 208-220 |
| Real hardware readiness gate | Do not claim real adapter readiness until O0/Q4 evidence exists. | Orchestrator plan lines 290-309, 328-337; addendum lines 84-93 |
| Ticket code pilot default | Runtime creates kiosk-scoped HMAC ticket codes; pilot default is staff visual redemption. | PRD lines 1016-1052; addendum lines 96-149 |
| Package validation | Pilot uses SHA-256 file digests; production requires Ed25519 manifest signatures. | Addendum lines 128-142 |
| Remote command safety | Commands are allowlisted, role-scoped, audited, and cannot execute arbitrary dashboard-supplied shell. | PRD lines 1136-1154; orchestrator plan lines 328-337 |
| MVP acceptance structure | Use staged review/QA gates, not a single “done” claim. | PRD lines 638-690; addendum lines 152-179; orchestrator plan lines 75-116 |

---

## Open decision gate card proposals

### Gate 1 — Approve MVP implementation start boundary

- Context: The PRD says implementation must not start until the reviewed PRD, orchestrator plan, and addendum are accepted. The addendum says I1/fake-flow is unblocked, but that still needs explicit approval.
- Options:
  - Approve I1 through fake-flow cards only.
  - Approve the full task graph except physical gates.
  - Keep all implementation blocked pending further PRD edits.
- Recommended default: Approve I1/R1/I2/R2/I3/I4/Q1 and I5/Q2 fake-flow work only; keep O0/I10/Q4 and production rollout gates explicit.
- Impact of delay: No implementation cards should be dispatched; the board remains in planning mode.
- Owner/approver: JM, with orchestrator recording the approval on the board.
- Evidence: PRD lines 902-913; orchestrator plan lines 328-337, 341-363.

### Gate 2 — Lock MVP scope: fake-flow MVP vs HQ physical MVP

- Context: The PRD includes both fake-flow acceptance and HQ physical acceptance, while the plan says fake work must not wait on unavailable physical hardware.
- Options:
  - Define MVP as fake token → session → ticket → fake print → reset.
  - Define MVP as HQ physical token → play → thermal print → reboot recovery.
  - Define two milestones: implementation MVP and HQ physical pilot readiness.
- Recommended default: Use two milestones: `MVP-Fake` for implementation progress and `MVP-HQ` for physical pilot readiness.
- Impact of delay: Teams may overclaim readiness or block all software work on hardware availability.
- Owner/approver: JM + orchestrator + QA/review lane.
- Evidence: PRD lines 638-690; orchestrator plan lines 313-320, 328-337; addendum lines 152-179.

### Gate 3 — Confirm first campaign content and launch trigger

- Context: The PRD names a Chocomel-style first campaign, but current repo docs include Dr Oetker campaign artifacts and parent baseline notes reference Dr Oetker changes. Token insertion is central in the PRD flow, but project rules warn token-required behavior must be campaign-specific.
- Options:
  - Chocomel-style generic demo package.
  - Dr Oetker pizza wheel package.
  - Neutral internal HQ demo campaign with no brand dependency.
  - Token-triggered, operator-triggered, schedule/autoplay, or mixed launch modes.
- Recommended default: For MVP fake-flow, use the existing/current campaign package only if JM confirms it; otherwise use neutral internal demo. Keep token-trigger as a campaign setting, not a platform-wide assumption.
- Impact of delay: Package schema, player screens, ticket copy, legal copy, and QA fixtures can drift from the intended pilot.
- Owner/approver: JM/product owner; scribe updates PRD; coder/webtester use the approved fixture.
- Evidence: PRD lines 71-82, 203-214, 847-858; orchestrator plan lines 221-232.

### Gate 4 — Decide token/payment/legal classification

- Context: The PRD explicitly leaves “treat token as payment?” open if the payment/legal model changes.
- Options:
  - Free/staff/customer token with no payment processing.
  - Paid token/payment-adjacent flow requiring legal/compliance review.
  - Campaign-specific token modes with payment class explicitly disabled for v1.
- Recommended default: Keep v1 as free/staff/customer promotional token and explicitly out of payment processing/compliance.
- Impact of delay: Data retention, refund/payment compliance, UI copy, legal text, and analytics semantics may require rework.
- Owner/approver: JM + legal/compliance if payment is considered.
- Evidence: PRD lines 84-94, 847-858.

### Gate 5 — Confirm physical kiosk runtime baseline

- Context: Addendum D2 lists likely OS/hardware assumptions but keeps target path, browser, display, and device facts configurable until HQ evidence exists.
- Options:
  - Linux Mint 22.3 target.
  - Ubuntu LTS target.
  - Support both via configurable systemd/CUPS/Tailscale runbooks.
- Recommended default: Support Ubuntu-family assumptions in code/runbooks; require target-device evidence before hardcoding paths, browser package/channel, rotation, or power settings.
- Impact of delay: I9 ops scaffold can proceed generically, but final kiosk-mode/systemd acceptance cannot be claimed.
- Owner/approver: Ops + JM/operator with target device access.
- Evidence: PRD lines 736-757; orchestrator plan lines 278-295; addendum lines 71-93, 194-205.

### Gate 6 — Capture token hardware protocol details

- Context: Hardware baseline identifies CH340 USB serial but baud/framing/denomination mapping and raw token event mapping are unknown.
- Options:
  - Standard serial settings with configurable baud/framing/debounce.
  - Device-specific parser after raw hex capture.
  - Block real token support until HQ capture exists.
- Recommended default: Build configurable serial adapter seams only; block real support claim until O0 records raw token hex and normalized mapping.
- Impact of delay: Fake-flow can continue; I10 real token adapter and Q4 physical checklist remain blocked.
- Owner/approver: Ops captures evidence; coder implements after O0; roger reviews.
- Evidence: PRD lines 297-310, 680-689; orchestrator plan lines 290-309; addendum lines 73-93, 200-201.

### Gate 7 — Confirm printer queue, paper profile, cutter, and QR readability

- Context: The PRD requires real thermal print; addendum says printer is likely ICOD/PT80KM through CUPS, but paper dimensions/cutter/QR readability are unknown.
- Options:
  - CUPS image-print adapter only for v1.
  - Direct ESC/POS/raw adapter if O0 proves CUPS is insufficient.
  - Fake print only until physical printer evidence exists.
- Recommended default: Implement CUPS adapter first after O0; keep paper profile configurable and block QR/redemption acceptance until a physical test print is captured.
- Impact of delay: Ticket renderer dimensions, print result handling, and acceptance tests cannot be finalized.
- Owner/approver: Ops + QA + JM/operator.
- Evidence: PRD lines 638-690, 1177-1188; orchestrator plan lines 290-309; addendum lines 78-80, 90-92, 202.

### Gate 8 — Decide offline redemption value, expiry, and fraud controls

- Context: HMAC ticket policy is resolved for low-value pilot tickets, but higher-value campaigns need explicit decisions on check length, online validation, duplicate handling, expiry strictness, and lost/cloned kiosk policy.
- Options:
  - Low-value staff visual redemption with 6-character HMAC check.
  - Higher-value QR/central validation with 10-12 character check.
  - Campaign-specific redemption models with explicit expiry and duplicate policy.
- Recommended default: Pilot uses `staff_visual_v1`; require a separate JM/legal decision before raising redemption value or requiring online validation.
- Impact of delay: Ticket schema and print copy can start for low-value pilot, but higher-value campaigns must not be promised.
- Owner/approver: JM + campaign owner + legal/compliance if value increases.
- Evidence: PRD lines 1016-1052; addendum lines 112-149, 204.

### Gate 9 — Decide degraded-mode customer behavior and staff messaging

- Context: The PRD lists degraded states and hardware failure behavior, but exact customer/staff messaging and reprint/operator flows are not final.
- Options:
  - Block sessions when printer/token is unhealthy.
  - Allow play and defer/retry print with staff intervention.
  - Operator reprint flow for post-result printer failure.
- Recommended default: Block new sessions when printer or token input is offline; for post-result printer failure, retry limited times, log append-only, and show staff/help message. Treat operator reprint as a controlled admin/operator action.
- Impact of delay: Player state machine, admin commands, and QA acceptance tests will encode different UX and operational policies.
- Owner/approver: JM + operations + UX/webtester.
- Evidence: PRD lines 287-295, 474-506, 1177-1188; orchestrator plan lines 215-232.

### Gate 10 — Decide observability minimum for MVP acceptance

- Context: The PRD defines heartbeat fields and diagnostic bundle expectations; the plan requires every implementation card to report real command/test output.
- Options:
  - Minimal heartbeat/status only.
  - Heartbeat + queue length + last session/print + diagnostics bundle.
  - Full metrics/log aggregation beyond MVP.
- Recommended default: Require heartbeat, queue length, last session/print result, command result evidence, and diagnostics bundle metadata for MVP; defer full Prometheus/Grafana-style observability.
- Impact of delay: QA cannot prove offline/sync/command behavior consistently across cards.
- Owner/approver: Roger/review + ops + analyst for final synthesis.
- Evidence: PRD lines 314-347, 1202-1224; orchestrator plan lines 238-267, 324-337.

### Gate 11 — Decide rollout/go-no-go criteria and deferral policy

- Context: Final synthesis must separate code-complete, fake-flow-complete, hardware-validated, and HQ-pilot-ready statuses.
- Options:
  - Go/no-go only after all Q gates including physical Q4.
  - Allow fake-flow go while marking hardware deferred.
  - Allow HQ pilot with documented hardware blockers waived by JM.
- Recommended default: Use four statuses: `code-complete`, `fake-flow-complete`, `hardware-validated`, `HQ-pilot-ready`; only JM can waive a hardware blocker, and the waiver must be documented.
- Impact of delay: The team may treat Kanban completion as deployment readiness.
- Owner/approver: Analyst for F1 report; JM for go/no-go.
- Evidence: Orchestrator plan lines 313-320, 328-337; addendum lines 176-179.

### Gate 12 — Lock acceptance-test ownership and evidence format

- Context: The PRD lists acceptance criteria, while the orchestrator plan assigns review/QA lanes. Evidence shape must be consistent before cards run.
- Options:
  - Each coder self-reports test output.
  - Reviewer/webtester cards independently verify acceptance with command/browser evidence.
  - Central evidence bundle per milestone.
- Recommended default: Require implementers to report command output; reviewers/webtesters independently verify with narrow smoke/E2E evidence; F1 synthesizes milestone evidence without replacing review gates.
- Impact of delay: Review cards can become subjective and downstream workers may lack proof of what actually passed.
- Owner/approver: Orchestrator + roger + webtester.
- Evidence: PRD lines 638-690; orchestrator plan lines 75-116, 324-337; addendum lines 152-179.

---

## Suggested next board actions

1. Create/confirm one approval gate card: `Approve MVP fake-flow implementation boundary` assigned to `analyst` or `orchestrator`, blocked for JM approval.
2. Create operational decision/evidence cards only where unresolved facts affect implementation:
   - runtime baseline / kiosk host facts;
   - token serial mapping;
   - printer paper/queue/QR evidence;
   - campaign identity and launch trigger;
   - redemption value/fraud policy.
3. Do not recreate D1-D3 as open decisions; they are resolved and should remain implementation constraints.
4. Keep fake-flow cards unblocked after JM approval, but keep I10/Q4 and HQ-pilot-ready status blocked until O0 evidence or explicit JM waiver.

---

## DOX closeout

- Changed file: `docs/mvp-decision-gates.md`.
- Nearest owning DOX: root `AGENTS.md`; no child `docs/AGENTS.md` exists.
- Root `AGENTS.md` already indexes `docs/` as product docs, decisions, physical hardware evidence, orchestrator plans, and runbooks, so no AGENTS.md update was required.
- No feature code, runtime contracts, package schema, or infrastructure files were changed.
