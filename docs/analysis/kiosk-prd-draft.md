# Kiosk PRD Draft (Jan 2026)

**Supermarket Gamified Kiosk Platform**

---

## 1. Executive Summary

Deploy a network of **300+ interactive kiosks** in supermarket environments for dual purposes: **Gamified Marketing** (driving foot traffic via promotional coins) and **Customer Data Enrichment** (linking gameplay to loyalty profiles).

**Core Philosophy:** Local-First architecture with true offline resilience. Kiosks remain fully functional during network outages, with instant sync when connectivity returns.

---

## 2. Technology Stack

### Frontend Stack
```
Vite + React
├── Quiz/Game → Optimistic UI (instant feedback)
├── Ad rotator → 100MB MP4 videos (Service Worker cache)
├── Touch UI → Fullscreen kiosk mode
└── Electron → Hardware access + X11 lockdown
```

### State & Sync
```
CONVEX NATIVE (Built-in Offline)
├── React Query + Convex SDK → Optimistic updates
├── Auto-queuing → Mutations queue offline, replay on reconnect
├── Real-time subscriptions → Live dashboard updates
└── Service Worker → Asset caching for offline playback
```

### Cloud Backend
- **Convex** - Central command for all kiosks with real-time subscriptions, auth, file storage, and vector search built-in
- **Real-time admin dashboard**
- **Ad rotation via Convex File Storage**

### Hardware Integration

| Component | Model | Interface |
|-----------|-------|-----------|
| **Thermal Printer** | Masung MS-MD80I | `/dev/usb/lp0` ESC/POS |
| **Barcode Scanner** | Honeywell Voyager 1200g | HID keyboard (onKeyDown) |
| **Coin Acceptor** | Generic | Pulse/Serial |
| **Touchscreen** | - | Chromium --touch-events |
| **5G Router** | Teltonika | Ethernet (driverless) |

### Deployment & Operations

```
OS: Ubuntu 24.04 LTS (X11 Lockdown)
├── Dockerized Electron app
├── Ansible: docker pull + restart all kiosks
├── GitHub Actions: CI/CD pipeline
└── X11 Config: No Alt+Tab, no TTY escape
```

**Rollout Time:** 1 docker push → 2-minute global rollout

---

## 3. Offline Behavior

| Feature | Offline Support |
|---------|-----------------|
| Quiz playable | ✅ (Service Worker cache) |
| Scores queued | ✅ (Convex offline mutations) |
| Videos play | ✅ (Cache API + /tmp) |
| Print/scan work | ✅ (local USB) |
| New ads | ❌ (wait for reconnect) |

---

## 4. User Journeys

### A. The Shopper (Player)

1. **Acquisition** - Receives promotional token outside store
2. **Attraction** - Sees Kiosk running high-quality video ads
3. **Engagement**
   - Inserts Token
   - **Filter:** Simple quiz question
   - Fail: "Try again next time" (token retained)
   - Pass: Game unlocks
4. **Game** - Plays Slot Machine
5. **Reward**
   - Wins voucher (e.g., €5)
   - Thermal printer issues QR ticket
   - Redeems at checkout

### B. The Store Manager (Admin)

1. **Monitoring** - Web dashboard: "Kiosk #3 Online. 50 games today."
2. **Configuration** - Adjust Win Rate / Daily Budget remotely
3. **Updates** - Upload new video → Kiosk downloads + auto-plays

---

## 5. Development Roadmap

### Phase 0: MVP (Foundation)
- Standalone, coin-operated kiosk
- Hardware: Coin Acceptor + Printer
- Software: Basic Game Loop (Quiz → Slot → Print)
- Local RNG for prizes
- Unidirectional logging via Convex mutations (auto-queues offline)
- No personal data (anonymous)

### Phase 1: Remote Management
- Admin Dashboard (Win/Loss ratios)
- Ad Rotation Manager (remote video upload)
- Kill Switch (disable if budget exceeded)

### Phase 2: Loyalty Integration
- Add Barcode/QR Reader (Honeywell 1200g)
- Loyalty Card scanning
- Cloud lookup: "Most Purchased Item"
- Dynamic prizes: "Win your favorite Coffee"
- Retargeting: Consolation coupons for non-winners

---

## 6. Production Scale

| Metric | Value |
|--------|-------|
| Kiosks | 300 |
| Video cache per kiosk | ~1GB |
| Total storage | 300GB |
| Convex hosting | Included |
| Campaign rollout | ~2 minutes |

---

## 7. Campaign Rollout Example (2 Minutes)

```bash
# Admin action
1. convex files upload ads/coca-cola.mp4
2. Update ads document in Convex: { videoUrl: ..., id: 'promo-001' }

# Result
# All 300 kiosks sync via Convex real-time subscriptions
```

---

## 8. Architecture Decision Record

**Decision:** Electron + Vite + React + Convex (Native) + Docker

**Rationale:**
- ✅ Printer/scanner hardware access
- ✅ Offline quiz resilience (Convex auto-queues mutations)
- ✅ Instant global ad updates (real-time subscriptions)
- ✅ Touch + X11 lockdown
- ✅ 100MB video caching (Service Worker)
- ✅ Zero store visits for updates
- ✅ Simpler than Replicache (uses Convex SDK directly)

**Trade-offs:**
- Electron bundle size vs native (~150MB overhead)
- Service Worker complexity vs manual cache
- Docker complexity vs bare metal

**Why No Replicache:**
- Convex SDK has built-in offline mutation queuing
- React Query provides optimistic UI
- Service Worker handles asset caching
- Fewer moving parts = simpler architecture

---

*Ready for 300+ supermarket deployments*
