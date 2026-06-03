# Admin Dashboard Draft

## Purpose

The admin dashboard allows Acmea/operator staff to monitor kiosks, inspect user interactions, manage campaigns, and execute remote operations such as reboot, redeploy, rollback, and test printing.

## Main Screens

### 1. Fleet Overview

Shows all kiosks with health status.

Fields:

- kiosk name
- location
- online/offline/error/maintenance
- last seen
- current app version
- today plays
- today tickets printed
- printer status
- coin acceptor status
- queue length
- disk/memory warnings

### 2. Kiosk Detail

Per-device operational view.

Sections:

- live state: idle, coin inserted, spinning, question, printing, error
- heartbeat timeline
- active campaign
- app/backend/agent versions
- printer status
- coin acceptor status
- latest events
- local queue length
- recent errors
- remote action buttons

Remote actions:

- restart browser
- restart backend
- reboot kiosk
- test print
- upload logs
- deploy version
- rollback version
- enter maintenance mode
- resume normal mode

### 3. Campaign Manager

Controls product/logo/game configuration.

Fields:

- campaign name
- brand/product
- active locations/kiosks
- active dates
- language
- product logos/assets
- wheel segments
- prizes
- questions
- ticket template

### 4. Interaction Analytics

Marketing/operator analytics.

Metrics:

- plays by day/location/kiosk
- coins inserted
- sessions completed
- question answer rates
- prize distribution
- print success/failure rate
- idle-to-play conversion if proximity sensor is later added

### 5. Deployment Center

Controls software rollout.

Fields:

- release version
- changelog
- target kiosks
- rollout status
- health check result
- rollback status

### 6. Audit Log

Append-only log of important activity.

Events:

- admin login
- remote reboot
- remote deploy
- rollback
- test print
- campaign update
- prize/rule update
- ticket print failures

## Roles

### Viewer

- Can view fleet and analytics.
- Cannot issue commands.

### Operator

- Can test print, restart browser/backend, maintenance mode.
- Cannot deploy/rollback unless explicitly allowed.

### Admin

- Can manage campaigns, deployments, and remote commands.

### Superadmin

- Full access including user management and dangerous operations.

## Operational Guardrails

- Reboot/deploy/rollback should require explicit confirmation.
- All commands must be logged with admin user and timestamp.
- Failed deployments must auto-rollback if health checks fail.
- Remote commands should expire if kiosk is offline too long.
- Printer test should clearly mark tickets as test tickets.
