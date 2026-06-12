# Capability Spec — Campaign Packages

## ADDED Requirements

### Requirement: Campaign packages must be data-driven and versioned

A campaign package MUST define brand and game configuration as data that can be versioned, validated, cached locally, and loaded without changing shared runtime source code.

#### Scenario: Chocomel runs as Campaign #1

- **GIVEN** `campaigns/chocomel/campaign.json` is valid
- **WHEN** it is selected as the active campaign
- **THEN** the kiosk runtime and player render Chocomel content without Chocomel-specific runtime code.

### Requirement: Campaign manifests must support game-template selection

Campaign manifests MUST declare which game template they use.

#### Scenario: Spin-wheel template selected

- **GIVEN** the Chocomel campaign declares `gameTemplate: spin-wheel`
- **WHEN** the kiosk player loads the manifest
- **THEN** it renders the spin-wheel flow using the campaign's wheel segments, copy, and theme.

### Requirement: Campaign package must classify assets by usage rights

Every asset in a campaign package SHALL declare usage classification.

Allowed classifications:

- `production`
- `prototype-reference`
- `placeholder`

#### Scenario: Public web asset is not production-approved

- **GIVEN** a Chocomel asset URL references public FrieslandCampina web content
- **WHEN** the manifest is validated or reviewed
- **THEN** the asset is classified as `prototype-reference`.

### Requirement: Campaign package must define ticket output intent

Campaign packages SHALL define ticket output content separately from visual game copy.

#### Scenario: Prize produces printed ticket

- **GIVEN** a prize has a print label or ticket template
- **WHEN** the backend prints a ticket
- **THEN** the ticket content comes from campaign-approved print fields, not arbitrary frontend text.

### Requirement: Platform must prove multi-campaign support early

The implementation SHALL include at least one non-Chocomel sample campaign before production hardening.

#### Scenario: Sample campaign loads without code changes

- **GIVEN** a second valid campaign package exists
- **WHEN** local runtime selects it as active campaign
- **THEN** the kiosk player renders it without source changes.
