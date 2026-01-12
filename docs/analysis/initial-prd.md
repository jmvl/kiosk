Here is the high-level **Product Requirements Document (PRD)** using the **BMAD Framework**. This document serves as the strategic blueprint for the development team, focusing on vision, architecture, and user experience without getting bogged down in implementation code.

---

# Project Vision & PRD: The Gamified Supermarket Kiosk

## 1. Executive Summary

The goal is to deploy a network of interactive, modular kiosks in supermarket environments. These kiosks serve a dual purpose: **Gamified Marketing** (driving foot traffic via promotional coins distributed externally) and **Customer Data Enrichment** (linking gameplay to loyalty profiles).

The system is designed with a **"Local-First" philosophy**. While connected via 5G for real-time management, the kiosk must remain fully functional for gameplay and advertising even during total network failure. The architecture allows for rapid iteration, starting with a simple token-based game and evolving into a personalized loyalty interface.

## 2. Core Capabilities & Architectural Philosophy

### A. Modular Design (The HAL Approach)

We are not building a single "Slot Machine app"; we are building a generic **Kiosk Platform**.

- **Hardware Abstraction Layer (HAL):** The software treats inputs generically. Today, the input is a "Coin Pulse"; tomorrow, it is a "Barcode Scan" or "NFC Tap." The game logic remains untouched when hardware changes.
- **Game Modularity:** The logic distinguishes between the _Trigger_ (Coin), the _Filter_ (Quiz), and the _Outcome_ (Slot Game/Printer). This allows us to swap the Quiz for a Survey or the Slot Machine for a "Wheel of Fortune" seamlessly.

### B. The Local-First Model

To ensure zero downtime in a retail environment, we utilize **Convex's native offline capabilities**.

- **Instant Interaction (Local):** Game state lives in React state with optimistic updates. The UI responds immediately to user actions (0ms latency) without waiting for server round-trips.
- **Automatic Synchronization (Convex):** Convex's SDK handles offline mutation queuing automatically. When 5G is available, mutations sync instantly. When offline, they queue and replay on reconnect.
- **Asset Caching (Service Worker):** Videos, questions, and static assets are cached locally via Service Worker + Cache API for true offline playback.

---

## 3. Technology Stack Overview

### Software

- **User Interface (Frontend):** **Vite + React**. Chosen for its rich animation capabilities and component modularity.
- **Host Container:** **Electron (Linux)**. Provides the "Kiosk Mode" security sandbox while granting access to low-level hardware (USB/Serial ports), with X11 lockdown.
- **State Management:** **React Query (TanStack Query)** + **Convex SDK**. Optimistic updates, automatic offline queuing, and real-time subscriptions.
- **Cloud Backend:** **Convex**. Acts as the central command center for all kiosks, managing global configuration, user data, and real-time admin dashboards with built-in real-time subscriptions, auth, file storage, and vector search.
- **Asset Caching:** **Service Worker + Cache API**. Videos and questions cached locally for offline playback.
- **Local Persistence:** **IndexedDB** + **File System (/tmp)**. For game state and heavy media assets (video ads).

### Hardware

- **Compute:** Industrial Mini-PC with **Ubuntu 24.04 LTS**.
- **Connectivity:** **Teltonika 5G Router** (Ethernet link). This "Driverless" approach ensures the kiosk OS is decoupled from modem drivers.
- **Peripherals:**
  - **Coin Acceptor** (Pulse/Serial)
  - **Thermal Printer:** **Masung MS-MD80I** via `/dev/usb/lp0` using raw ESC/POS commands, with GS v 0 for bitmap logos/QR codes (escpos-usb npm)
  - **Barcode Scanner:** **Honeywell Voyager 1200g** (HID keyboard via React onKeyDown events)
  - **Touchscreen:** Chromium --touch-events support
- **Video Storage:** `/tmp/kiosk-ads/` with 100MB per video, ~30GB total cache per kiosk

### Deployment & Operations

- **Deployment:** Dockerized Electron app with Ansible orchestration for 300+ kiosks
- **CI/CD:** GitHub Actions pipeline for automated builds
- **Updates:** 1 docker push → 2-minute global rollout
- **X11 Lockdown:** No Alt+Tab, no TTY escape for public kiosk security

### Offline Behavior

✅ Quiz playable (questions cached via Service Worker)
✅ Scores queued (Convex offline mutations)
✅ Videos play (Cache API + /tmp fallback)
✅ Print/scan work (local USB)
❌ New ads wait for sync (auto-retry on reconnect)

### Production Scale

- **300 kiosks × 1GB video cache = 300GB total storage**
- **Convex hosting: Included with platform**
- **Reliability:** Survives WiFi/power outages

---

## 4. User Journeys

### A. The Shopper (The "Player")

1.  **Acquisition:** The user receives a promotional token (or sees a printed QR code) outside the supermarket (e.g., in a flyer or at a partner store).
2.  **Attraction:** The user enters the supermarket and sees the Kiosk running high-quality video advertisements (played locally).
3.  **Engagement:**
    - User inserts the Token.
    - **The Filter:** A simple question appears (e.g., "What is the store's color?").
    - _Fail:_ "Try again next time." (Token retained).
    - _Pass:_ The Game unlocks.
4.  **The Game:** The user plays the Slot Machine. The reels spin.
5.  **Reward:**
    - The user wins (e.g., €5 voucher).
    - The Thermal Printer issues a ticket with a unique QR code.
    - The user redeems the ticket at the checkout.

### B. The Store Manager (The "Admin")

1.  **Monitoring:** Accesses a web dashboard (Convex) to see live status: "Kiosk #3 is Online. 50 games played today."
2.  **Configuration:** Adjusts the "Win Rate" or "Daily Budget" remotely.
3.  **Updates:** Uploads a new "Christmas Promotion" video. The Kiosk downloads it in the background and starts playing it automatically once ready.

---

## 5. Development Roadmap (Phasing)

### Phase 0: The MVP (Foundation)

- **Goal:** A standalone, coin-operated kiosk.
- **Hardware:** Coin Acceptor + Printer.
- **Software:**
  - Basic Game Loop (Quiz -> Slot -> Print).
  - Local RNG (Random Number Generator) for prizes.
  - Unidirectional Logging (Kiosk -> Cloud) via Convex mutations (auto-queues offline).
- **Constraint:** No personal data collection. Purely anonymous gameplay.

### Phase 1: Remote Management & Stability

- **Goal:** Full remote control.
- **Features:**
  - Admin Dashboard for configuring Win/Loss ratios.
  - Ad Rotation Manager (Remote video upload).
  - "Kill Switch" (Disable game remotely if budget is exceeded).

### Phase 2: Loyalty & Intelligence (The Big Leap)

- **Goal:** Personalized data-driven promotion.
- **Hardware:** Add Barcode/QR Reader.
- **Features:**
  - **Identification:** User scans Loyalty Card.
  - **Cloud Lookup:** Kiosk queries Convex (which proxies the Store API) to fetch "Most Purchased Item."
  - **Personalization:** The Slot Machine prizes change dynamically (e.g., "Win your favorite Coffee brand").
  - **Retargeting:** Non-winners receive a "Consolation Coupon" specific to their habits.
