# Capability Spec — Fleet Management

## ADDED Requirements

### Requirement: Kiosks must have durable identity

Each kiosk MUST have a durable identity that includes an immutable serial number, human-readable name, assigned location, current software versions, active campaign, and last known status.

#### Scenario: Kiosk registers with serial number

- **GIVEN** a new kiosk is provisioned
- **WHEN** it registers with the central API
- **THEN** the central platform stores its unique serial number and assigns or confirms kiosk id, name, and location.

#### Scenario: Kiosk name changes without changing serial

- **GIVEN** an admin renames a kiosk
- **WHEN** the kiosk detail is updated
- **THEN** the serial number remains unchanged and audit history still links to the same kiosk.

### Requirement: Kiosks must report GPS telemetry when available

Each kiosk SHALL report GPS coordinates when a GPS chip/module is available.

#### Scenario: Kiosk sends GPS heartbeat

- **GIVEN** GPS hardware is available and readable by the kiosk agent
- **WHEN** the kiosk sends heartbeat telemetry
- **THEN** the heartbeat includes latitude, longitude, accuracy, and GPS timestamp.

#### Scenario: GPS unavailable indoors

- **GIVEN** GPS signal is unavailable or unreliable
- **WHEN** the kiosk sends heartbeat telemetry
- **THEN** campaign play continues and the platform marks GPS status as unavailable or stale.

### Requirement: Platform must detect location mismatch

The platform SHALL compare kiosk GPS telemetry with its assigned expected location/geofence.

#### Scenario: Kiosk reports outside expected geofence

- **GIVEN** a kiosk has an assigned expected GPS location and geofence radius
- **WHEN** reported GPS coordinates are outside that geofence
- **THEN** the admin dashboard flags a location mismatch warning.

### Requirement: Fleet overview must scale to 100+ kiosks

The admin dashboard MUST support monitoring at least 100 kiosks with filters for status, location, campaign, version, and warnings.

#### Scenario: Operator filters offline kiosks

- **GIVEN** the fleet has 100 kiosks
- **WHEN** an operator filters by offline status
- **THEN** the dashboard shows offline kiosks with last seen time, location, active campaign, and queue length.
