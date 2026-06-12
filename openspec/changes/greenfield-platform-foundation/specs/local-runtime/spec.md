# Capability Spec — Local Kiosk Runtime

## ADDED Requirements

### Requirement: Local runtime must own paid session state

The local runtime API MUST own paid session lifecycle state, including coin insertion, session start, spin authorization, prize decision, question answer recording, print request, and session completion.

#### Scenario: Coin starts a paid session

- **GIVEN** the kiosk is idle with an active campaign loaded
- **WHEN** a coin insertion event is received from simulated or real hardware
- **THEN** the local runtime creates a paid session and emits a session state update to the kiosk player.

#### Scenario: Browser cannot create completed sessions directly

- **GIVEN** the browser sends a request that attempts to skip directly to completed/prize state
- **WHEN** the local runtime receives the request
- **THEN** it rejects the invalid transition and records an audit event.

### Requirement: Local runtime must enforce prize and print integrity

The local runtime API MUST determine or confirm prize outcome before any ticket can be printed.

#### Scenario: Prize is selected by backend

- **GIVEN** a valid paid session is ready to spin
- **WHEN** the spin is requested
- **THEN** the local runtime records the selected prize according to campaign rules before the player reveals it.

#### Scenario: Duplicate ticket print is prevented

- **GIVEN** a ticket has already been printed for a completed session
- **WHEN** another print request is made for the same session
- **THEN** the runtime refuses the duplicate print and records the refusal.

### Requirement: Local runtime must persist and buffer events locally

The local runtime MUST persist session and event data locally so kiosk operation and audit data survive internet outages, central API outages, and process restarts.

The local runtime MUST assign each locally recorded event a durable identifier, sync status, retry metadata, and timestamp so unsynced events can be pushed later without loss or duplication.

#### Scenario: Internet disconnects during operation

- **GIVEN** the kiosk is running a valid active campaign
- **WHEN** internet connectivity is unavailable
- **THEN** the kiosk still accepts coin events, runs sessions, selects prizes, prints authorized tickets, and records all events locally.

#### Scenario: Runtime restarts after events are queued

- **GIVEN** events were recorded while the central API was unavailable
- **WHEN** the local runtime restarts
- **THEN** unsynced events are still available for later sync.

#### Scenario: Internet connectivity returns

- **GIVEN** unsynced events are buffered locally
- **WHEN** the central API becomes reachable again
- **THEN** the local runtime or kiosk agent pushes queued events to the central API and marks successfully acknowledged events as synced.

#### Scenario: Event push is retried safely

- **GIVEN** an event push partially fails or the acknowledgement is lost
- **WHEN** the sync worker retries
- **THEN** duplicate central records are prevented using idempotency keys based on durable local event ids.

### Requirement: Local runtime must expose health and state endpoints

The local runtime MUST expose health and current state APIs for kiosk player, kiosk agent, and operator diagnostics.

#### Scenario: Kiosk agent checks local health

- **GIVEN** the kiosk agent polls local runtime health
- **WHEN** `/api/health` is requested
- **THEN** the response includes service status, active campaign id, session state, queue length, and timestamp.
