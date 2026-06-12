# Capability Spec — Greenfield Tech Stack

## ADDED Requirements

### Requirement: Platform must use a TypeScript-first monorepo

The platform MUST use a TypeScript-first monorepo so frontend, backend, campaign schemas, event contracts, and admin tooling can share types and validation contracts.

#### Scenario: Shared campaign contract

- **GIVEN** a campaign manifest is defined in `campaigns/chocomel/campaign.json`
- **WHEN** the local runtime API serves it and the kiosk player consumes it
- **THEN** both services use the same shared campaign contract from `packages/campaign-schema`.

### Requirement: pnpm workspaces must manage packages

The repository MUST use `pnpm` workspaces for apps, services, and packages.

#### Scenario: Workspace build

- **GIVEN** the repository has app, service, and package workspaces
- **WHEN** `pnpm build` runs at the repo root
- **THEN** all buildable workspaces compile successfully.

### Requirement: Runtime validation must exist for external/config data

The platform MUST validate campaign manifests and API payloads at runtime, not only with compile-time TypeScript interfaces.

#### Scenario: Invalid campaign is rejected

- **GIVEN** a campaign manifest is missing required fields such as `id`, `slug`, `gameTemplate`, or `wheelSegments`
- **WHEN** the local runtime API loads the manifest
- **THEN** validation fails before the kiosk player can run the campaign.

### Requirement: Deployment foundation must support Docker and Caddy

The central/API/admin deployment foundation SHALL support Docker Compose and Caddy reverse proxy configuration.

#### Scenario: Central services are prepared for SSL routing

- **GIVEN** central API and admin dashboard services exist
- **WHEN** deployment configuration is created
- **THEN** Caddy can route HTTPS traffic to those services with auto-SSL.

### Requirement: Kiosk host services must be systemd-compatible

The kiosk runtime SHALL include systemd service examples or deployment docs for starting kiosk player, local runtime API, and kiosk agent on boot.

#### Scenario: Kiosk recovers after reboot

- **GIVEN** the kiosk host restarts
- **WHEN** systemd starts configured services
- **THEN** local runtime API and kiosk player return to operational attract mode automatically.
