# Delta for Restore Recovery

## ADDED Requirements

### Requirement: Restore to known-good snapshot

The platform MUST support restoring kiosk software to a known-good snapshot after severe failure, corrupted local runtime state, or failed deployment recovery.

#### Scenario: Operator triggers restore snapshot

- GIVEN a kiosk is reachable through the kiosk agent
- WHEN an authorized operator sends a restore snapshot command
- THEN the kiosk agent starts the restore workflow
- AND records local restore intent before making changes.

### Requirement: Unsynced events preserved before restore

The kiosk MUST preserve or back up unsynced local event data before executing a restore snapshot workflow.

#### Scenario: Kiosk has pending unsynced events

- GIVEN the local event buffer contains pending or failed events
- WHEN restore snapshot is requested
- THEN the kiosk attempts to flush or back up unsynced events before restore
- AND restore MUST NOT delete the only copy of those unsynced events.

### Requirement: Restore audit trail

The kiosk and central platform MUST record restore request, restore start, restore outcome, actor, target kiosk, snapshot/version identifier, and any data preservation warnings.

#### Scenario: Restore completes while central connectivity is unavailable

- GIVEN central connectivity is unavailable during restore
- WHEN restore completes locally
- THEN the kiosk stores the restore audit event locally
- AND syncs it to the central platform when connectivity returns.

### Requirement: Post-restore health verification

After restore, the kiosk MUST verify local runtime health, kiosk player health, campaign cache validity, and required hardware/service availability before resuming normal operation.

#### Scenario: Restore completes and health checks pass

- GIVEN restore has completed
- AND local runtime, kiosk player, campaign cache, and required services are healthy
- WHEN the kiosk exits restore workflow
- THEN it returns to attract mode for the active or fallback campaign.

#### Scenario: Restore completes but campaign cache is invalid

- GIVEN restore has completed
- AND the active campaign cache is missing or invalid
- WHEN post-restore health verification runs
- THEN the kiosk remains in error or maintenance mode
- AND reports recovery action required to the central platform.

### Requirement: Destructive factory reset excluded by default

The platform MUST NOT perform destructive factory reset behavior that wipes event history, identity, or unsynced data unless a future explicitly approved requirement defines that workflow.

#### Scenario: Restore command is executed

- GIVEN an operator sends restore snapshot
- WHEN the kiosk executes the restore workflow
- THEN the kiosk preserves identity and unsynced data according to the restore requirements
- AND does not perform a destructive factory reset.
