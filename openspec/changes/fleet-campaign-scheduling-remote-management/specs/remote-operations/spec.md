# Delta for Remote Operations

## ADDED Requirements

### Requirement: Remote command lifecycle

The platform MUST manage remote kiosk commands through a durable lifecycle that includes pending, sent, acknowledged, running, succeeded, failed, expired, and cancelled states.

#### Scenario: Command completes successfully

- GIVEN an authorized operator creates a restart player command for a kiosk
- WHEN the kiosk agent receives, acknowledges, runs, and completes the command
- THEN the command lifecycle records pending, sent, acknowledged, running, and succeeded timestamps
- AND the result is visible in command history.

#### Scenario: Command expires before execution

- GIVEN a command has an expiry timestamp
- WHEN the kiosk agent does not acknowledge or run the command before expiry
- THEN the command is marked expired
- AND the kiosk agent does not execute it later.

### Requirement: Initial remote command set

The platform MUST support remote command definitions for restarting the kiosk player, restarting the local runtime API, restarting the kiosk agent, rebooting the system, testing print, uploading logs, entering maintenance mode, resuming normal mode, refreshing campaign cache, deploying a version, rolling back a version, and restoring a snapshot.

#### Scenario: Operator requests log upload

- GIVEN a kiosk is online
- WHEN an operator sends an upload logs command
- THEN the kiosk agent uploads or prepares a log bundle
- AND the central platform records command result metadata.

### Requirement: Command authorization and audit

Every remote command MUST be authorized, scoped to target kiosks, idempotent, expiring, and audit logged with actor, target, command type, payload, timestamps, and result.

#### Scenario: Unauthorized user attempts reboot

- GIVEN a user lacks permission to reboot kiosks
- WHEN the user attempts to create a reboot command
- THEN the platform rejects the command
- AND no command is delivered to the kiosk.

### Requirement: Idempotent command execution

A kiosk agent MUST NOT execute the same command more than once even if command delivery or polling returns the same command repeatedly.

#### Scenario: Duplicate command delivery

- GIVEN the kiosk agent already executed command `cmd-123`
- WHEN the central command endpoint returns `cmd-123` again due to retry or network race
- THEN the kiosk agent reports the existing result instead of executing the command again.

### Requirement: Maintenance mode

The platform MUST support a maintenance mode that prevents new paid sessions while allowing diagnostics, heartbeat telemetry, log upload, and recovery commands.

#### Scenario: Operator enters maintenance mode

- GIVEN a kiosk is online and not currently in a paid session
- WHEN an operator sends enter maintenance mode
- THEN the kiosk stops accepting new paid sessions
- AND continues reporting heartbeat and command status.

### Requirement: Version rollback

The platform SHALL support rolling kiosk software back to a previous known-good player, runtime, or agent version when a deployment fails health checks.

#### Scenario: Deployment fails health check

- GIVEN a new kiosk player version was deployed
- AND the kiosk fails post-deployment health checks
- WHEN rollback is triggered
- THEN the kiosk reverts to the previous known-good version
- AND records deployment and rollback audit events.
