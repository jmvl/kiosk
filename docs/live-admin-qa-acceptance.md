# Live Admin QA Acceptance — Scheduler and Game Run Log

## Decision

A8/A9 live `/admin` QA must expect the scheduler and recent game run log/history panels.

This is not an accepted scope exception. The prior live QA absence finding was treated as stale after investigation showed the deployed `/admin` bundle now contains and renders those panels.

## Required live QA assertions

For A8/A9 live QA, the tester must verify all of the following on the live kiosk URL, not a local fallback:

- Open `http://192.168.1.117:8787/admin` and confirm the page is the `Retail Kiosk Admin` dashboard.
- Confirm a visible `Scheduler` region/panel is present.
- Confirm a visible `Recent game run log` region/panel is present.
- Confirm scheduler data is backed by `/schedules` or the runtime `scheduler` object from `/state`.
- Confirm recent game run/history data is backed by `/admin/api/game-runs`.
- Treat absence of either panel as a live QA failure unless a later product decision explicitly records a scope exception.

## Smoke assertion expectation

The admin dashboard smoke test should keep bundle/source assertions for the restored operator panels:

```text
source contains <SchedulerPanel ... />
source contains <GameRunLogPanel ... />
source contains aria-label="Scheduler"
source contains aria-label="Recent game run log"
bundle contains "Scheduler"
bundle contains "Recent game run log"
bundle contains "/schedules"
bundle contains "/admin/api/game-runs"
```

## Acceptance language

Use this language when writing or reviewing A8/A9 QA notes:

> Live `/admin` acceptance requires visible `Scheduler` and `Recent game run log` panels. QA should fail the live admin check if either panel is absent, because scheduler and game run/history visibility remain in scope for A8/A9. There is no accepted scope exception for hiding these panels on live `/admin`.

## Superseded evidence note

`qa-artifacts/t_fdc189e9/live-qa-report.md` recorded `containsScheduler=false` and `containsGameRunLog=false` for an older live deployment. The follow-up investigation for `t_f0bfdbbf` found the current live bundle asset `index-CgnoHnD5.js` includes scheduler and game run log strings, APIs, and visible DOM text. Treat the older absence report as stale for current live `/admin` scope.
