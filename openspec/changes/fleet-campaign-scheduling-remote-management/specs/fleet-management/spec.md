# Delta for Fleet Management

## ADDED Requirements

### Requirement: Kiosk durable identity

Each kiosk MUST have a durable identity containing an immutable serial number, mutable human-readable name, assigned location, assigned groups, current status, current software versions, active campaign, next scheduled campaign, local queue length, and last-seen timestamp.

#### Scenario: Kiosk registers with serial number

- GIVEN a new kiosk agent starts with a configured serial number
- WHEN it sends its first registration or heartbeat to the central API
- THEN the platform creates or confirms the kiosk record using the immutable serial number
- AND the platform stores or returns the assigned kiosk id, name, location, and groups.

#### Scenario: Kiosk is renamed

- GIVEN an operator renames a kiosk in the admin dashboard
- WHEN the kiosk record is updated
- THEN the kiosk name changes
- AND the serial number remains unchanged
- AND historical events remain linked to the same kiosk identity.

### Requirement: Kiosk heartbeat telemetry

Each kiosk MUST send periodic heartbeat telemetry that allows the central platform to determine whether the kiosk is online, offline, stale, in warning state, in error state, or in maintenance mode.

#### Scenario: Kiosk heartbeat is fresh

- GIVEN a kiosk sends heartbeat telemetry within the configured heartbeat window
- WHEN the central platform evaluates fleet status
- THEN the kiosk is considered online unless reported service health indicates warning, error, or maintenance mode.

#### Scenario: Kiosk heartbeat is stale

- GIVEN a kiosk has not sent heartbeat telemetry within the configured stale threshold
- WHEN the central platform evaluates fleet status
- THEN the kiosk is marked stale or offline with its last-seen timestamp visible to operators.

### Requirement: GPS telemetry when hardware is available

Each kiosk SHALL report GPS latitude, longitude, accuracy, timestamp, and GPS status when a GPS chip/module is available and readable by the kiosk agent.

#### Scenario: GPS module is available

- GIVEN a kiosk has a readable GPS module
- WHEN the kiosk sends heartbeat telemetry
- THEN the heartbeat includes latitude, longitude, accuracy, GPS timestamp, and GPS status.

#### Scenario: GPS signal is unavailable

- GIVEN a kiosk cannot obtain reliable GPS signal
- WHEN the kiosk sends heartbeat telemetry
- THEN campaign play continues
- AND the platform records GPS status as unavailable, stale, or degraded.

### Requirement: Location mismatch warnings

The platform SHALL compare kiosk GPS telemetry with the kiosk's assigned expected location or geofence when expected coordinates are configured.

#### Scenario: Kiosk reports outside expected geofence

- GIVEN a kiosk has expected coordinates and geofence radius configured
- WHEN reported GPS coordinates are outside the geofence beyond tolerance
- THEN the dashboard flags a location mismatch warning
- AND paid campaign operation is not automatically blocked.

### Requirement: Fleet overview at 100+ kiosk scale

The admin/API layer MUST support monitoring at least 100 kiosks with filtering and sorting by status, location, campaign, version, last seen, local queue length, and warning type.

#### Scenario: Operator filters offline kiosks

- GIVEN the fleet has at least 100 kiosks
- WHEN an operator filters by offline status
- THEN the dashboard/API returns offline kiosks with serial number, name, location, last seen time, active campaign, and queue length.
