# Capability Spec — Campaign Runtime

## ADDED Requirements

### Requirement: Campaign manifests must drive branded kiosk experiences

The kiosk platform MUST render branded campaign experiences from a campaign manifest rather than hardcoding campaign-specific copy, theme, assets, questions, prizes, or wheel segments into the shared runtime.

#### Scenario: Chocomel campaign loads through manifest

- **GIVEN** the active campaign is `chocomel-2026`
- **WHEN** the kiosk player starts
- **THEN** it renders Chocomel brand copy, theme, wheel segments, questions, and prize labels from the Chocomel campaign manifest.

#### Scenario: Future campaign package uses same runtime

- **GIVEN** a second valid campaign manifest exists
- **WHEN** the active campaign changes to that manifest
- **THEN** the kiosk player can render the second campaign without changing shared runtime source code.

### Requirement: Backend must remain source of truth for session and prize state

The local backend MUST own coin events, session creation, prize selection, duplicate-ticket prevention, and print-event recording.

#### Scenario: Frontend requests spin but backend records prize

- **GIVEN** a paid session has started
- **WHEN** the user spins the wheel
- **THEN** the local backend records the selected prize/result before any ticket print is queued.

#### Scenario: Browser cannot print arbitrary prizes

- **GIVEN** the frontend attempts to claim or print a prize not authorized by the local backend
- **WHEN** the print request is received
- **THEN** the backend rejects or ignores the request and records an audit event.

### Requirement: Campaign assets must carry usage classification

Each campaign asset SHALL declare whether it is production-approved, prototype reference, or placeholder.

#### Scenario: Prototype asset is used in Chocomel MVP

- **GIVEN** a Chocomel asset points to a public FrieslandCampina page image
- **WHEN** the campaign manifest is reviewed
- **THEN** the asset is marked `prototype-reference`, not `production`.

### Requirement: Runtime must support offline play

The kiosk runtime MUST continue running the active cached campaign if the central backend is unavailable.

#### Scenario: Network unavailable during supermarket activation

- **GIVEN** the kiosk has a valid local campaign manifest and local backend is healthy
- **WHEN** internet connectivity is unavailable
- **THEN** users can still insert coins, play, receive results, and print tickets, with events queued locally for later sync.

### Requirement: Events must be auditable

The platform MUST record key lifecycle events for campaign sessions.

#### Scenario: Completed play is logged

- **GIVEN** a user completes a Chocomel spin-wheel session
- **WHEN** the session resets
- **THEN** events exist for coin insertion, session start, spin request, prize selection, question answer, print request, print result, and session completion.
