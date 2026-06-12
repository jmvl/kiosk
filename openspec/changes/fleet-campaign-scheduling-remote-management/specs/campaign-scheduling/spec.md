# Delta for Campaign Scheduling

## ADDED Requirements

### Requirement: Campaign assignment targets

The platform MUST allow authorized operators to assign a campaign schedule to one kiosk, one location, one group, or the whole fleet.

#### Scenario: Schedule targets a location

- GIVEN a campaign package is valid and published
- WHEN an operator assigns the campaign to a location schedule
- THEN every eligible kiosk assigned to that location receives or can fetch the schedule and required campaign cache instructions.

### Requirement: Calendar-based campaign schedules

The platform MUST support calendar-based campaign schedules with start datetime, end datetime, timezone, priority, fallback campaign, and campaign version.

#### Scenario: Campaigns switch by local schedule

- GIVEN Campaign A is scheduled from 09:00 to 12:00 in the location timezone
- AND Campaign B is scheduled from 12:00 to 18:00 in the same timezone
- WHEN the kiosk local schedule evaluator reaches 12:00
- THEN the kiosk switches from Campaign A to Campaign B if Campaign B is cached, valid, and compatible.

### Requirement: Offline-safe scheduled activation

A kiosk MUST be able to activate an upcoming scheduled campaign while offline when that campaign package and schedule entry were cached locally before the outage.

#### Scenario: Internet is unavailable at switch time

- GIVEN Campaign B is scheduled after Campaign A
- AND Campaign B is already cached and validated locally
- AND internet connectivity is unavailable at Campaign B's start time
- WHEN the scheduled start time arrives
- THEN the local runtime activates Campaign B without waiting for central connectivity
- AND records a local schedule activation event for later sync.

### Requirement: Campaign cache readiness

The platform MUST track whether targeted kiosks have cached required campaign packages before the scheduled start time.

#### Scenario: Campaign package is not cached before start

- GIVEN a schedule requires Campaign B to be cached before activation
- AND a targeted kiosk has not confirmed cache readiness
- WHEN an operator views the campaign calendar
- THEN the platform shows the kiosk as not ready for that schedule.

### Requirement: Schedule conflict detection

The central platform MUST detect conflicting campaign assignments before publishing schedules to kiosks.

#### Scenario: Equal-priority schedules overlap

- GIVEN two schedule entries target the same kiosk during overlapping time windows
- AND both schedules have equal priority
- WHEN an operator attempts to publish the schedules
- THEN the platform rejects or flags the conflict before the schedules are delivered to kiosks.

### Requirement: Safe fallback campaign behavior

If a scheduled campaign is missing, invalid, corrupted, incompatible, or not cached, the kiosk MUST continue a valid current campaign or switch to a configured fallback campaign instead of showing a blank screen.

#### Scenario: Scheduled campaign fails validation

- GIVEN a scheduled campaign package fails local validation
- WHEN its activation time arrives
- THEN the kiosk keeps running the current campaign or switches to the configured fallback campaign
- AND records an error event for later sync.
