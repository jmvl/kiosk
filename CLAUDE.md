# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **BMAD (Business Methods & Architecture Development) workspace** - not a traditional software project. BMAD is a comprehensive AI-powered development framework that provides workflows, agents, and tools for software development lifecycle management.

The repository contains BMAD framework configuration files, workflow definitions, agent specifications, and output directories for artifacts generated during development sessions.

## Architecture

### BMAD Framework Structure

```
_bmad/
├── core/           # Core BMAD module (shared workflows, tasks, agents)
├── bmm/            # Business Methods Module (industry-specific workflows)
├── _config/        # Configuration files and manifests
└── _output/        # Generated artifacts (not committed to git)
```

### Key Components

**Workflows** (`_bmad/core/workflows/`, `_bmad/bmm/workflows/`):
- Structured processes for development activities (PRD creation, architecture design, test planning, etc.)
- Each workflow has steps, checklists, templates, and instructions
- Workflows are invoked via slash commands (e.g., `/bmad-workflow-bmm-create-prd`)

**Agents** (`_bmad/core/agents/`, `_bmad/bmm/agents/`):
- Specialized AI personas with specific roles (architect, dev, pm, ux-designer, etc.)
- Each agent has a configuration file defining their behavior and expertise

**Commands** (`.claude/commands/` and `.gemini/commands/`):
- Slash-command definitions for invoking workflows and agents
- Organized by module (core vs bmm) and type (workflows vs agents vs tasks)

**Configuration**:
- `_bmad/core/config.yaml` - Core module settings (user name, languages, output paths)
- `_bmad/bmm/config.yaml` - BMM module settings (project name, skill level, artifact paths)
- `.mcp.json` - MCP server configuration (AgentVibes for TTS)

### Output Artifacts

Generated files are written to `_bmad-output/`:
- `planning-artifacts/` - PRDs, architecture docs, UX designs
- `implementation-artifacts/` - Stories, tech specs, test plans

These directories are gitignored as they are session-specific outputs.

## Development Workflow

BMAD follows a structured development pipeline:

1. **Analysis** (`1-analysis/`): Market/domain research, product briefs
2. **Planning** (`2-plan-workflows/`): PRDs, UX designs
3. **Solutioning** (`3-solutioning/`): Architecture, epics/stories, readiness checks
4. **Implementation** (`4-implementation/`): Sprint planning, story dev, code review

Use `/bmad-workflow-bmm-workflow-status` to see current project status and next steps.

## Commands

### Workflow Commands
- `/bmad-workflow-bmm-create-prd` - Create Product Requirements Document
- `/bmad-workflow-bmm-create-architecture` - Design system architecture
- `/bmad-workflow-bmm-create-epics-and-stories` - Break down into epics and stories
- `/bmad-workflow-bmm-sprint-planning` - Plan sprint work
- `/bmad-workflow-bmm-dev-story` - Implement a user story
- `/bmad-workflow-bmm-code-review` - Review code changes
- `/bmad-workflow-bmm-workflow-status` - Check project status
- `/bmad-workflow-core-brainstorming` - Brainstorming session
- `/bmad-workflow-core-party-mode` - Multi-agent discussion

### Agent Commands
- `/bmad-agent-bmm-architect` - Architect agent
- `/bmad-agent-bmm-dev` - Developer agent
- `/bmad-agent-bmm-pm` - Product Manager agent
- `/bmad-agent-bmm-ux-designer` - UX Designer agent

### Task Commands
- `/bmad-task-core-index-docs` - Index documentation

## AgentVibes Integration

This workspace uses **AgentVibes** for text-to-speech feedback:
- Voice configuration: `.claude/config/tts-voice.txt`
- Verbosity: `.claude/config/tts-verbosity.txt` (low/medium/high)
- Background music: `.claude/config/background-music.txt`

TTS announcements play at task acknowledgment and completion when enabled.

## IDE Integration

BMAD is configured for **Claude Code** IDE (`_bmad/_config/ides/claude-code.yaml`).

For Gemini IDE, command definitions are in `.gemini/commands/` with matching `.toml` files.

## Notes

- This is a configuration/project management workspace, not a source code repository
- The `kiosk` project name in config is a placeholder - no actual kiosk application exists here
- All actual development work happens in separate project repositories that import BMAD workflows
- Version: BMAD 6.0.0-alpha.22
