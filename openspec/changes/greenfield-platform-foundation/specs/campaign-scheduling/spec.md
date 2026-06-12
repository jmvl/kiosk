# Capability Spec — Campaign Scheduling

## ADDED Requirements

### Requirement: Campaigns must be remotely assignable

Authorized campaign managers or admins MUST be able to assign campaigns to one kiosk, a location, a group, or the whole fleet.

#### Scenario: Campaign assigned to one location

- **GIVEN** a campaign package is valid and published
- **WHEN** a campaign manager assigns it to a location
- **THEN** all targeted kiosks receive or queue campaign cache instructions.

### Requirement: Campaigns must support calendar schedules

The platform MUST support calendar-based campaign schedules with start/end times, timezone handling, priorities, and fallback campaigns.

#### Scenario: Two campaigns follow each other

- **GIVEN** Campaign A is scheduled from 09:00 to 12:00 and Campaign B from 12:00 to 18:00 in the location timezone
- **WHEN** the local kiosk time reaches 12:00
- **THEN** the kiosk switches from Campaign A to Campaign B if Campaign B is cached and valid.

### Requirement: Upcoming campaigns must be cached locally

Kiosks MUST cache upcoming scheduled campaign packages before their scheduled start time when connectivity is available.

#### Scenario: Internet goes down before scheduled switch

- **GIVEN** Campaign B is scheduled next and already cached locally
- **WHEN** internet connectivity is unavailable at the scheduled switch time
- **THEN** the kiosk can switch to Campaign B locally.

### Requirement: Schedule conflicts must be detected before publish

The central platform MUST detect conflicting campaign assignments before publishing schedules.

#### Scenario: Conflicting campaigns target same kiosk

- **GIVEN** two active schedules target the same kiosk at overlapping times with equal priority
- **WHEN** a campaign manager attempts to publish the schedule
- **THEN** the platform rejects or flags the conflict before it reaches the kiosk.

### Requirement: Invalid scheduled campaign must fall back safely

If a scheduled campaign is missing, invalid, corrupted, or not cached, the kiosk MUST continue a valid current or fallback campaign instead of going blank.

#### Scenario: Scheduled campaign is invalid

- **GIVEN** a scheduled campaign fails validation on the kiosk
- **WHEN** its activation time arrives
- **THEN** the kiosk keeps running the current campaign or switches to a configured fallback campaign and records an error event.
