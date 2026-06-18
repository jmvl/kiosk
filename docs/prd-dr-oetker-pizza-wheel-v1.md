# PRD — Dr. Oetker Pizza Wheel of Fortune v1

> Status: Proposed for JM review  
> Project: Retail Kiosk Activation / `jmvl/kiosk`  
> Campaign package target: `campaigns/dr-oetker-pizza-wheel/`  
> Market: Belgium  
> Languages: French Belgium (`fr-BE`) and Dutch Belgium (`nl-BE`)  
> Date: 2026-06-18

---

## 1. Executive Summary

Dr. Oetker Pizza Wheel of Fortune is a bilingual Belgian supermarket kiosk activation. A shopper receives a physical plastic token at the cashier after purchase. The shopper inserts the token into the kiosk, answers a simple three-choice Dr. Oetker question, and if correct spins a pizza-themed reward wheel. The local kiosk backend selects the outcome using admin-configured weighted rules. Depending on outcome configuration, the thermal printer issues a localized ticket containing a QR code and a human-readable signed code.

The product is intentionally framed as a French `concours` / Dutch `wedstrijd`, not gambling. The quiz gate, purchase-qualified token, backend-controlled outcomes, localized ticketing, and audit trail are core product requirements.

The v1 goal is a KISS, reliable, brand-safe activation package on top of the existing kiosk platform. Avoid POS integration, complex staff workflows, and customer-facing recovery mechanisms unless later approved.

---

## 2. Goals

### Business Goals

- Deliver a Dr. Oetker-branded supermarket activation that is more measurable than a static promo display.
- Drive shopper engagement after purchase using a physical cashier-issued token.
- Print a cashier-scannable QR ticket and human-readable fallback code.
- Support French and Dutch UX/ticketing for Belgium.
- Keep the campaign reusable as an activation package pattern for future brands.

### Product Goals

- Make the experience simple enough for a shopper to complete without staff help.
- Present the mechanic as a contest/promo activation, not a chance-money game.
- Allow superadmin/campaign owner to configure quiz, outcomes, tickets, QR payloads, visual assets, and probabilities.
- Keep store operators read-only for campaign content in v1.

### Technical Goals

- Implement as a versioned campaign package under the existing `retail-kiosk-activation` monorepo.
- Keep local backend authoritative for session, outcome, ticket code, print request, and audit events.
- Keep game module responsible for presentation and animation only.
- Support offline token -> quiz -> spin -> ticket operation.
- Validate all customer-facing copy in `fr-BE` and `nl-BE`.

---

## 3. Non-Goals for v1

- No direct supermarket POS coupon integration unless explicitly provided by retailer.
- No payment handling; the plastic token is not payment.
- No customer account, email, phone, or personal data capture.
- No store-operator editing of live campaign copy or ticket templates.
- No complex crash recovery or token refund workflow.
- No approval workflow for store edits.
- No hard dependency on internet to play, select outcome, or print ticket.
- No casino/slot-machine visuals, jackpot language, or harsh gambling vocabulary.

---

## 4. Core User Flow

```text
Idle / attract screen
  -> shopper inserts cashier-issued plastic token
  -> kiosk starts session in default store language
  -> shopper may switch FR/NL before answering
  -> bilingual/localized quiz shown in selected language
  -> wrong answer #1: friendly retry
  -> wrong answer #2: session ends, reset, no reward
  -> correct answer: spin button becomes available
  -> shopper taps spin
  -> backend selects outcome by configured weights/caps
  -> pizza wheel animates to matching visual segment
  -> localized reveal shown
  -> if outcome config says print: ticket prints in session language
  -> ticket includes bitmap/template, QR, and human-readable code
  -> session resets to idle
```

---

## 5. Locked Decisions and KISS Defaults

| Area | Decision / Default |
|---|---|
| Brand | Dr. Oetker Pizza |
| Market | Belgium |
| Languages | `fr-BE`, `nl-BE` required for all user-facing copy |
| Framing | `concours` / `wedstrijd`, not gambling |
| Start trigger | Physical plastic token from cashier after purchase |
| Token meaning | Purchase-qualified participation trigger, not payment |
| Token consumption | Consumed when backend accepts token event |
| Language mode | Kiosk/store default language with visible FR/NL switch |
| Language lock | Locks at first quiz answer selection |
| Quiz | Exactly one active question, exactly three choices, exactly one correct answer |
| Quiz source | Package default + superadmin/campaign-owner override |
| Wrong answer #1 | Friendly retry |
| Wrong answer #2 | End session, reset, no reward |
| Crash/session loss | Customer asks cashier; no complex recovery in v1 |
| Spin trigger | Shopper taps explicit spin button after correct answer |
| Outcome selection | Backend selects at spin start |
| Outcome model | Generic admin-configurable outcomes |
| Probability model | Backend weights/caps, separate from visual wheel segments |
| Ticket behavior | Per outcome: print/no-print/template/QR/copy configurable |
| Ticket language | Same as session language |
| Ticket payload | QR + human-readable signed code |
| Ticket graphic | Admin-configured bitmap/template by outcome/use case |
| Admin edit rights | Superadmin/campaign owner only in v1 |
| Store operator rights | Read-only campaign content; operational controls only |
| Wheel visual | Hybrid pizza + prize wheel |
| Default loss stance | No harsh loss; admin may configure no-print/loss, but seeded campaign should favor consolation/high-win |

---

## 6. Bilingual Requirements

### Supported Languages

- French Belgium: `fr-BE`
- Dutch Belgium: `nl-BE`

### Rules

- The kiosk has a store/kiosk default language.
- A visible `FR | NL` switch is available before the user selects a quiz answer.
- Once the first answer is selected, the session language is locked.
- Quiz, answer choices, retry copy, reveal copy, ticket text, cashier instructions, terms, and error/reset copy must use session language.
- Missing copy in either language must fail package/admin validation unless an explicit approved fallback is configured.
- Do not show fully bilingual primary UI on every screen; avoid clutter. Use selected language for primary interaction.

---

## 7. Token and Session Rules

### Token Source

- Shopper receives a plastic token at cashier after purchase.
- Token is inserted into kiosk to start one session.
- Token is not payment and must not be described as payment.

### Token Consumption

- Token is consumed when backend accepts token event and starts a session.
- No refund/recovery in customer UI.
- If hardware/session crashes, customer can ask cashier for help.

### Timeout Defaults

| State | Timeout | Action |
|---|---:|---|
| After token / before quiz answer | 45 seconds | Reset |
| After first wrong answer | 30 seconds | Reset |
| Ready to spin | 30 seconds | Reset |
| Prize reveal after print/no-print | 10-15 seconds | Reset |
| Printer failure screen | 45-60 seconds | Ask cashier, then reset |

Timeout values should be campaign/admin configurable within safe min/max ranges.

---

## 8. Quiz Requirements

### Functional Rules

- One active question per campaign/location/schedule slot.
- Exactly 3 answer choices.
- Exactly 1 correct answer.
- Question and answer copy required in `fr-BE` and `nl-BE`.
- Superadmin/campaign owner can override package default question.
- Store operators cannot edit live questions in v1.

### Attempt Logic

```text
attempt 1 wrong -> show friendly retry
attempt 2 wrong -> show polite no-reward/thanks message -> reset
correct -> unlock spin button
```

### Copy Tone

Avoid shame/friction. Suggested copy:

- FR wrong #1: `Presque ! Essayez encore.`
- NL wrong #1: `Bijna! Probeer opnieuw.`
- FR failed: `Dommage, ce n’est pas la bonne réponse. Merci de votre participation.`
- NL failed: `Jammer, dat is niet het juiste antwoord. Bedankt voor uw deelname.`

---

## 9. Outcome and Wheel Requirements

### Backend Authority

- Backend chooses outcome at spin start.
- Frontend/game module must not choose prize/outcome.
- Wheel receives selected outcome and animates to a matching visual segment.
- Every outcome selection must be logged append-only.

### Outcome Config Fields

Minimum fields:

```text
outcome_id
outcome_type: win | loss | consolation | grand_prize | custom
active: boolean
localized_label.fr-BE
localized_label.nl-BE
weight
inventory_cap_optional
daily_cap_optional
print_ticket: boolean
ticket_template_id
bitmap_asset_id
qr_payload_template
cashier_instruction.fr-BE
cashier_instruction.nl-BE
terms.fr-BE
terms.nl-BE
```

### Probability Model

- Use backend `weight`, not exact user-entered percentages as the core model.
- Admin UI may display normalized percentages for preview only.
- Visual wheel segments are separate from backend weights.
- Rare prizes do not need visually tiny segments.

### Visual Wheel

Default visual style: hybrid pizza + prize wheel.

Requirements:

- Looks like a pizza from a distance.
- Still clearly reads as a spin wheel.
- Uses Dr. Oetker-safe family-friendly visual tone.
- Avoids casino-like lights, slot-machine symbols, jackpot language, or aggressive flashing.
- Supports mapping multiple visual segments to one outcome if needed.

---

## 10. Ticket and QR Requirements

### Ticket Output

- Ticket language equals session language.
- Ticket may print or not print depending on outcome config.
- Printed ticket includes:
  - campaign/brand header bitmap or configured graphic;
  - localized outcome headline;
  - QR code;
  - human-readable signed ticket code;
  - localized cashier instruction;
  - localized terms/validity;
  - optional expiry timestamp/date.

### QR Payload

KISS v1 default:

```text
QR = admin-configured redemption URL pattern + backend signed ticket code
Human-readable code = same signed ticket code printed below QR
```

Example pattern:

```text
https://promo.acmea.tech/r/{{ticket_code}}
```

Future brand/retailer domain can replace it after approval:

```text
https://promo.oetker.be/r/{{ticket_code}}
```

### POS Integration

- Not required for v1.
- If retailer requires direct POS coupon scanning, this becomes a separate integration decision and implementation track.
- Until POS integration is confirmed, cashier can scan/read QR/code according to campaign instructions.

---

## 11. Admin Requirements

### Superadmin / Campaign Owner

Can configure:

- campaign metadata;
- active schedule/package;
- quiz question and answers;
- correct answer;
- outcomes and weights;
- inventory/daily caps;
- print/no-print behavior per outcome;
- ticket templates and bitmap assets;
- localized ticket copy;
- QR payload URL pattern;
- validity/expiry copy;
- wheel visual segment mapping;
- spin duration within safe range;
- timeout values within safe range.

### Store Operator

Can view:

- active campaign;
- current package;
- local hardware status;
- last session/ticket;
- game run log;
- printer/token status.

Can operate:

- test print where permitted;
- reset session;
- enter/exit maintenance mode.

Cannot edit in v1:

- quiz copy;
- answer choices;
- correct answer;
- ticket templates;
- outcome odds;
- legal/cashier terms.

---

## 12. Analytics and Event Logging

Minimum append-only events:

```text
token_inserted
session_started
language_selected
question_shown
answer_selected
answer_wrong
answer_correct
question_failed_attempt_limit
spin_button_shown
spin_started
outcome_selected
wheel_animation_completed
prize_revealed
ticket_print_requested
ticket_print_success
ticket_print_failed
session_timeout
session_reset
session_completed_no_reward
```

Analytics views should support:

- plays by language;
- answer correctness/failure rate;
- drop-offs by state;
- outcomes selected;
- tickets printed;
- print failures;
- per-kiosk and per-location metrics;
- campaign period totals.

---

## 13. Failure Behavior

### Wrong Answers

- First wrong answer: retry.
- Second wrong answer: polite no-reward message, reset.

### User Walk-Away

- Auto-reset by timeout.
- No customer-facing recovery.

### Printer Failure

KISS behavior:

- Show localized cashier-help message.
- Log print failure.
- Preserve ticket/session event evidence.
- Reset after timeout.

Suggested copy:

- FR: `Un problème d’impression est survenu. Veuillez demander de l’aide à la caisse.`
- NL: `Er is een printprobleem opgetreden. Vraag hulp aan de kassa.`

### Kiosk Crash

- Customer asks cashier for help.
- No v1 entitlement recovery guarantee in customer UI.
- Logs should help operators diagnose recurring problems.

---

## 14. Security and Compliance Posture

- Do not describe token as payment.
- Do not use gambling/casino copy or visuals.
- Backend generates signed ticket code.
- Campaign package cannot access ticket signing secret.
- Package/module cannot directly control printer, token input, OS, local DB, or network beyond approved bridge.
- QR/ticket code must be signed and auditable.
- Admin changes to quiz/tickets/outcomes must be audited.
- No PII capture in v1.

---

## 15. Activation Package Scope

Target package:

```text
campaigns/dr-oetker-pizza-wheel/
  manifest.json
  campaign.json
  module/index.html
  assets/
    wheel/
    tickets/
    brand/
  ticket-template/
```

### Package Must Include

- package metadata;
- default localized quiz;
- default localized outcome labels;
- default outcome table;
- visual wheel segment mapping;
- ticket templates/assets;
- QR payload template default;
- legal/terms placeholders;
- package file digests in manifest.

### Package Validation Must Enforce

- required `fr-BE` and `nl-BE` copy;
- exactly 3 quiz choices;
- exactly 1 correct answer;
- no unsafe file paths;
- bitmap assets exist and are listed;
- ticket template references valid assets;
- outcome weights are valid positive values for active outcomes;
- print-ticket outcomes have a valid ticket template;
- QR payload template includes `{{ticket_code}}` or approved equivalent.

---

## 16. Implementation Plan

### Phase 1 — Spec and Schema

- Add campaign schema extensions for quiz, localized copy, outcomes, ticket templates, bitmap assets, visual segments, QR payload templates.
- Add tests for required bilingual fields and quiz constraints.

### Phase 2 — Backend Runtime

- Add quiz session state and attempt tracking.
- Add backend outcome selection by weights and caps.
- Add event logging for quiz/spin/outcome/ticket flow.
- Add ticket rendering payload support for localized templates and QR payload.

### Phase 3 — Campaign Package

- Create `campaigns/dr-oetker-pizza-wheel/` package.
- Include placeholder/prototype-safe Dr. Oetker-inspired assets only until approved brand assets are available.
- Add localized quiz and outcomes.
- Add ticket templates for win/consolation/no-print/loss use cases.

### Phase 4 — Player Module

- Implement pizza wheel module using PixiJS + GSAP.
- Read session language and selected backend outcome.
- Animate to matching segment.
- Keep module presentation-only; no outcome authority.

### Phase 5 — Admin UI

- Add superadmin/campaign-owner editor/preview for quiz, outcomes, ticket templates, QR payload, and visual mapping.
- Store operator view remains read-only for campaign content.

### Phase 6 — QA

- Validate `pnpm package:validate`.
- Run `pnpm run ci`.
- Browser-test at kiosk viewport `1080x1920`.
- Fake token -> quiz -> wrong retry -> wrong reset.
- Fake token -> quiz correct -> spin -> outcome -> ticket -> reset.
- Verify FR ticket and NL ticket separately.
- Verify no frontend-generated outcome/ticket code.

### Phase 7 — Hardware Gate

Before HQ/pilot claim:

- target kiosk CH340 token evidence;
- real token event mapping;
- CUPS printer detection;
- app-level ticket print with QR;
- printer queue completion;
- fullscreen player evidence;
- admin status evidence;
- reset/maintenance evidence.

---

## 17. Acceptance Criteria

### Product Acceptance

- A shopper can complete the full flow in French.
- A shopper can complete the full flow in Dutch.
- One wrong answer allows retry.
- Two wrong answers end/reset the session.
- Correct answer unlocks explicit spin button.
- Wheel animation lands on backend-selected outcome.
- Ticket prints in session language when outcome requires printing.
- Ticket includes QR and human-readable code.
- Admin-configured bitmap/template appears on ticket.
- Campaign can be configured without code changes for quiz/outcomes/templates.

### Technical Acceptance

- `pnpm run ci` passes.
- `pnpm package:validate` passes.
- Campaign validation rejects missing FR/NL fields.
- Campaign validation rejects quiz with not exactly 3 choices or not exactly 1 correct answer.
- Outcome selection is server-side and tested.
- Ticket code generation remains backend-owned.
- Fake hardware full-flow smoke test passes.
- Browser console has no critical errors in full flow.

### Operational Acceptance

- Admin can preview active quiz/outcomes/ticket templates.
- Store operator cannot edit live campaign content.
- Game run log shows token, quiz attempts, outcome, ticket, print status, and reset.
- Printer failure is visible and instructs user to ask cashier.

---

## 18. Open Review Questions for JM

These are the remaining human/business review items before implementation cards:

1. Confirm whether Dr. Oetker brand assets are approved or prototype-only.
2. Confirm default seeded outcome table for first demo.
3. Confirm ticket validity period: same day, campaign period, or admin-configured per outcome.
4. Confirm QR domain for pilot: Acmea promo domain, retailer domain, or Dr. Oetker domain placeholder.
5. Confirm whether a true loss/no-print outcome should be seeded or only supported generically.
6. Confirm cashier instruction wording in French and Dutch.
7. Confirm whether grand prize/free product is allowed by retailer/brand, or discounts/consolation only.

---

## 19. Recommended JM Defaults for Open Questions

| Question | Recommended KISS Default |
|---|---|
| Brand assets | Use prototype-safe placeholders until approved assets are provided |
| Seed outcomes | Small discount, standard discount, consolation QR; no grand prize unless approved |
| Ticket validity | Same day by default; admin-configurable |
| QR domain | `https://promo.acmea.tech/r/{{ticket_code}}` for pilot |
| True loss | Do not seed harsh loss; support configurable no-print/loss generically |
| Cashier instruction | `Présentez ce ticket à la caisse.` / `Toon dit ticket aan de kassa.` |
| Grand prize | Defer until retailer/brand confirms redemption process |

---

## 20. Suggested Implementation Epic Title

```text
EPIC: Dr. Oetker Pizza Wheel bilingual concours activation package
```

Suggested first implementation cards:

1. Extend campaign schema for bilingual quiz/outcomes/ticket templates.
2. Implement local backend quiz attempts and outcome selection.
3. Create Dr. Oetker Pizza Wheel package scaffold.
4. Build pizza wheel module with backend-selected outcome animation.
5. Add localized QR ticket rendering templates.
6. Add admin preview/editor for superadmin campaign config.
7. Run fake-runtime browser QA for FR/NL full flow.
8. Run physical hardware gate when target kiosk is ready.
