# OpenSpec

This directory is the repo-local OpenSpec workspace for the Retail Kiosk Activation Platform.

It follows the Fission-AI OpenSpec model:

```text
openspec/
├── specs/              # Source of truth for current system behavior after sync/archive
├── changes/            # Proposed changes, one folder per change
│   └── <change-id>/
│       ├── proposal.md # why and what
│       ├── design.md   # technical approach
│       ├── tasks.md    # implementation checklist
│       └── specs/      # delta specs using ADDED/MODIFIED/REMOVED requirements
└── config.yaml         # repo-local OpenSpec config/context
```

## Current active changes

- `changes/greenfield-platform-foundation/` — primary planning change for the fleet-capable platform foundation.
- `changes/multi-campaign-kiosk-foundation/` — earlier campaign-runtime planning context. Keep only where it does not conflict with the greenfield foundation.

## Workflow for this chat room

1. Use brainstorming in chat for discovery.
2. When we decide to make it durable, write it into `openspec/changes/<change-id>/`.
3. Keep requirements in delta specs under `specs/<domain>/spec.md`.
4. Validate with:

```bash
openspec validate --all
```

5. Implement only after proposal/specs/design/tasks are coherent.
6. Later, use `openspec sync` / `openspec archive` when a change becomes current system behavior.

## Important correction

These files are local repo artifacts. They are not copied from the OpenSpec repository. The authoritative OpenSpec project is:

```text
https://github.com/Fission-AI/OpenSpec
```
