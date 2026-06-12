# Capability Spec — Restore and Recovery

## ADDED Requirements

### Requirement: Kiosks must support restore to known-good snapshot

The platform SHALL support restoring kiosk software to a known-good snapshot after severe failure.

#### Scenario: Admin triggers restore snapshot

- **GIVEN** a kiosk is in an unrecoverable error state and has an available known-good snapshot
- **WHEN** a superadmin issues a restore snapshot command
- **THEN** the kiosk restores player/runtime/agent services to the known-good snapshot and reports restore result.

### Requirement: Restore must preserve unsynced data

Restore operations MUST preserve or back up unsynced local event/session/ticket data before changing runtime state.

#### Scenario: Restore while offline queue has data

- **GIVEN** the kiosk has unsynced local events
- **WHEN** restore snapshot is requested
- **THEN** the restore process backs up or preserves the local event database before restoring software state.

### Requirement: Restore result must be audited

Every restore attempt MUST be audit-logged centrally when possible and locally always.

#### Scenario: Restore succeeds offline

- **GIVEN** central API is unavailable during restore
- **WHEN** restore completes successfully
- **THEN** the kiosk records the restore result locally and syncs it when connectivity returns.

### Requirement: Restored kiosk must return to attract mode when healthy

After successful restore, the kiosk SHALL return to operational attract mode if local runtime, campaign cache, and required hardware are healthy.

#### Scenario: Restore completes and campaign cache is valid

- **GIVEN** restore completes successfully and active campaign cache validates
- **WHEN** kiosk services restart
- **THEN** the player returns to attract mode and resumes normal operation.
