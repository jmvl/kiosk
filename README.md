# Kiosk - Gamified Supermarket Kiosk (Phase 0 MVP)

Loyalty Arcade promotional kiosk with slot machine gameplay.

## Prerequisites

- Node.js 18+
- npm or yarn
- Convex account (for backend)

## Quick Start

```bash
# Install dependencies
npm install

# Start Convex backend (in terminal 1)
npx convex dev

# Start development server (in terminal 2)
npm run dev

# Start Electron with hot reload
npm run electron:dev
```

## Environment Variables

Already configured in `.env.development`:

```bash
VITE_CONVEX_URL=https://clear-salmon-146.convex.site
VITE_KIOSK_ID=kiosk-001
VITE_LANGUAGE=fr
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run electron:dev` | Start Electron with hot reload |
| `npm run build` | Build for production |
| `npm run package` | Package Electron app for Linux |
| `npm run test` | Run unit tests |
| `npm run convex` | Start Convex backend |

## Project Structure

```
src/
├── main/              # Electron main process
│   ├── index.ts       # Entry point
│   └── preload.ts     # Security bridge
├── renderer/          # React frontend
│   ├── components/    # UI components
│   ├── hooks/         # React hooks
│   ├── services/      # Business logic
│   └── utils/         # Utilities
└── shared/            # Shared types
```

## Architecture

- **Frontend**: React + Vite
- **Container**: Electron (Linux kiosk mode)
- **Backend**: Convex (real-time cloud)
- **Storage**: IndexedDB (offline queue)
- **Hardware**: Keyboard events (coin, printer)

## Development Status

**Phase 0 MVP** - Ready for implementation

- ✅ Project scaffolding complete
- ✅ Convex schema defined
- ✅ Directory structure created
- ✅ Base services and hooks skeleton
- 🚧 Ready to begin Epic 1 Story 1

## Documentation

See `_bmad-output/planning-artifacts/` for:
- **architecture.md** - Complete technical architecture
- **epics.md** - 31 user stories across 6 epics
- **analysis/initial-prd.md** - Product requirements

## License

MIT
