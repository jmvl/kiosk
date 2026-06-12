# Capability Spec — Remote Operations and Control Plane

## ADDED Requirements

### Requirement: Kiosks must be remotely observable

The platform MUST support remote visibility into kiosk status, including online/offline state, serial number, kiosk name, assigned location, GPS telemetry, active campaign, upcoming campaign, software version, queue length, printer status, coin acceptor status, restore snapshot status, and recent errors.

#### Scenario: Operator views fleet health

- **GIVEN** multiple kiosks are deployed
- **WHEN** an operator opens the admin dashboard
- **THEN** each kiosk shows health, serial number/name, last seen time, location/GPS state, active campaign, upcoming campaign, current version, local queue length, restore snapshot status, and operational warnings.

### Requirement: Remote commands must be authenticated and audited

Remote commands MUST be authenticated, authorized, scoped, expiring, and audit-logged.

#### Scenario: Operator restarts backend

- **GIVEN** an operator with permission issues a restart-backend command
- **WHEN** the kiosk receives and executes the command
- **THEN** command request, delivery, execution result, and requesting admin are recorded.

#### Scenario: Superadmin restores snapshot

- **GIVEN** a kiosk is in severe failure and a known-good restore snapshot is available
- **WHEN** a superadmin issues a restore-snapshot command
- **THEN** the command is confirmed, executed, locally audited, and reported centrally when connectivity is available.

### Requirement: Kiosk must not require inbound public ports

The kiosk deployment MUST NOT require inbound public ports on supermarket networks.

#### Scenario: Emergency remote access required

- **GIVEN** a kiosk needs emergency maintenance
- **WHEN** an authorized operator accesses it remotely
- **THEN** access is performed through Tailscale/WireGuard or equivalent private networking, not open inbound public ports.

### Requirement: Deployment must support rollback

The platform SHALL support versioned deployments with previous-version rollback for kiosk services.

#### Scenario: New kiosk player version fails health check

- **GIVEN** a new kiosk player version is deployed
- **WHEN** post-deploy health check fails
- **THEN** the kiosk rolls back to the previous known-good version or marks itself for operator intervention.
