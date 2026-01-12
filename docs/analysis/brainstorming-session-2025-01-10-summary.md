# Gamified Supermarket Kiosk - Brainstorming Session Summary

**Date:** 2025-01-10
**Facilitator:** Jm
**Technique:** SCAMPER Method (Structured Thinking)
**Focus Areas:** UX Enhancements, Business Models, Feature Expansion

---

## Executive Summary

Through structured brainstorming using the SCAMPER technique, we refined the Gamified Supermarket Kiosk concept from the original PRD into a concrete, business-ready product roadmap. The session produced three validated concept directions, selected "Loyalty Arcade" as the primary path, and detailed Phase 0 MVP requirements with UX specifications, business model, and Phase 1/2 expansion plans.

**Key Outcome:** Direction 1 ("Loyalty Arcade") selected for Phase 0 MVP with slot machine as core game, loyalty card integration planned for Phase 2, and multi-game support in Phase 1.

---

## Selected Concept: Direction 1 - "Loyalty Arcade"

### Core Vision
A casino-inspired promotional kiosk that transforms anonymous coin play into a personalized loyalty experience over three phases, while maintaining local-first reliability and generating revenue through ad placements and data insights.

### Unique Value Proposition
- **For Shoppers:** Instant gratification (slot machine wins) + personalized prizes (Phase 2)
- **For Stores:** Foot traffic driver + customer data capture + promotional flexibility
- **For Brands:** Product placement on reels + performance analytics + attribution data (Phase 2)

---

## Phase 0 MVP - Concrete Specifications

### What the Shopper Experiences

**Game Flow (30-45 seconds total):**
1. Insert promotional token (coin)
2. Answer quiz question (90% pass rate designed for engagement)
3. Slot reels spin (3-4 seconds, slow for dramatic effect)
4. Win → confetti animation + thermal ticket prints with QR code
5. Redeem ticket at checkout (cashier scan OR self-scan)

**Quiz Questions:**
- Library size: 10 unique questions (cloud-fetched)
- Question types: Store facts + product trivia + seasonal/holiday
- Wrong answer: Show correct answer, token always taken
- Language: French + Dutch (Belgian market)

**Slot Machine Visuals:**
- Symbol mix: Product logos + generic symbols
- Revenue model: Product logos = paid ad placement (9 slots: 3 reels × 3 symbols)
- Branding: Heavily store-branded ("SUPERMART SPIN")
- Animation: Slow spin, confetti win celebration
- Screen: Vertical orientation (Linux drivers configured)

**Ticket Format:**
- "Surprise" ticket (prize revealed when printed, not on screen)
- Expiration: 24 hours (creates same-day urgency)
- Content: QR code only (minimalist)
- Redemption: Both cashier scan OR self-scan checkout

**Accessibility:**
- Input: Coin OR QR code scan (future-proofs for Phase 2)
- Audio: Optional sound effects (not required)
- Hardware: Fixed screen height (vertical orientation)

### What the Store Manager Controls

**Remote Configuration (Web Dashboard):**
- Win rate percentage (e.g., 20% of plays win)
- Daily voucher budget cap (stops awarding when exhausted)
- Prize tier distribution (70% €1 wins, 20% €3, 10% €5)
- Low-traffic stores: Can manually increase win odds
- High-performing stores: Contextual budget adjustments

**Content Management:**
- Upload new promotional videos (idle screen content)
- Change quiz questions (10-question library rotates)
- Scheduling: Monthly/weekly campaign cycles

**Real-Time Monitoring:**
- Kiosk status (online/offline, last activity)
- Today's play count + remaining budget
- Low paper alert (thermal printer)

### What the Store Chain Gains

**Customer Data & Insights:**
- Foot traffic patterns (time of day, day of week)
- Dwell time (post-play shopping duration)
- Redemption rates (ticket → purchase conversion)
- Location performance (which stores drive most engagement)

**Marketing Flexibility:**
- A/B testing capability (different questions, prizes, videos)
- Seasonal campaigns (holiday themes, promotional events)
- Targeted offers (demographic-specific promotions)

**Operational Reliability:**
- Offline resilience (continues working during network outage)
- Remote management (one person manages 100+ kiosks)
- Tamper resistance (Electron kiosk mode, locked-down software)

---

## Business Model

### Triple Revenue Stream

**1. Ad Sales (Primary Revenue)**
- **Reel Logo Placement:** Fixed monthly fee per brand × 9 slots (3 reels × 3 symbols)
- **Video Advertising:** Separate tier, monthly/weekly campaigns available
- **Bundling:** Brands can combine reel + video placement
- **Contract Terms:**
  - Month-to-month: Standard pricing
  - 3-month commitment: Discount applied
  - 1-year commitment: 30% discount (encourages lock-in)

**2. Data Monetization (High-Margin Scale)**
- Sell anonymized play data and insights to brands
- Example insights: "Coca-Cola logo generates 30% more plays at 5pm"
- Premium analytics tier for deeper behavioral insights
- Scales with network size (more kiosks = more data)

**3. Platform Fees (Stable Recurring Revenue)**
- **€250/month per kiosk** to stores
- Covers: Hardware, software, maintenance, support
- Stores treat as operational expense
- Predictable revenue stream

### Advertiser Value Proposition

**Metrics & Reporting:**
- **Dual KPI:** Plays (exposure) + Ticket Redemptions (purchase intent)
- **Real-Time Dashboard:** RBAC-controlled access for brands
- **Live Performance:** Brands view impressions and engagement instantly
- **Phase 2 Enhancement:** Attribution tracking (ad view → actual purchase via loyalty data)

**Targeting Options:**
- Time-based scheduling (morning vs evening ad mixes)
- Location-based targeting (store demographics)
- Seasonal campaigns (holiday themes, promotional events)

---

## Technology Stack (Confirmed from PRD)

### Software
- **Frontend:** React + Vite (rich animations, component modularity)
- **Host Container:** Electron (Linux) - kiosk mode security sandbox
- **Sync Engine:** Replicache (bidirectional offline queuing)
- **Cloud Backend:** Convex (central command, config, user data, dashboards)
- **Local Persistence:** SQLite + File System (black box logging + media assets)

### Hardware (Phase 0)
- **Mini-PC (Linux):** $150
- **Thermal Printer:** $75
- **Screen:** $90 (vertical orientation)
- **5G Router:** $30 (Teltonika, driverless approach)
- **Total:** ~$375 per kiosk

### Hardware (Phase 2 Addition)
- **Barcode Scanner:** $30 (loyalty card reader)
- **Total Phase 2:** ~$405 per kiosk

---

## Architecture Philosophy

### Local-First Design
- **Instant Interaction:** 0ms latency - game runs on local CPU, no server round-trip
- **Background Sync:** Replicache queues data locally, pushes to Convex when 5G active
- **Offline Resilience:** Kiosk remains fully functional during total network failure
- **Conflict Resolution:** Kiosk is source of truth for inventory (prevents overselling)

### Modular Architecture (HAL Approach)
- **Hardware Abstraction Layer:** Generic input handling
  - Today: Coin pulse
  - Tomorrow: Barcode scan, NFC tap, etc.
- **Game Modularity:** Trigger → Filter → Outcome
  - Trigger: Coin, loyalty tap, QR scan
  - Filter: Quiz, survey, skip (Phase 2)
  - Outcome: Slot, wheel, instant win
- **Swap Components:** Change quiz → survey, slot → wheel without touching game logic

---

## Development Roadmap

### Phase 0: MVP (Foundation)
**Goal:** Standalone, coin-operated promotional kiosk

**Hardware:** Coin acceptor + thermal printer + screen + 5G (~$375)
**Software:**
- Slot machine game (only game type)
- Local RNG for win determination
- Quiz filter (10 questions, cloud-fetched)
- One-way sync (kiosk → cloud for logging/analytics)
- Unidirectional data flow only

**Key Decisions:**
- Free play only (no paid tiers - avoids lottery regulations)
- Anonymous gameplay (no personal data)
- Win rate + daily budget: Admin-configurable
- Quiz refresh: Cloud-fetched per game

**Constraints:**
- No loyalty integration
- No multiple game types
- No two-way cloud communication
- Purely promotional (data collection only)

### Phase 1: Remote Management & Multi-Game
**Goal:** Full remote control + game variety

**New Features:**
- **Wheel of Fortune** game (second game option)
- **Instant Win** games (expand catalog)
- **Multi-Game Selection:** RBAC admin controls active game per kiosk
- **Game Switching:** Scheduler OR manual
- **Transition UX:** "Maintenance mode" screen (not abrupt cut)
- **Admin Dashboard:** Enhanced with game management
- **Ad Rotation Manager:** Remote video upload
- **Kill Switch:** Disable game when daily budget exceeded

**Technical Implications:**
- Game module architecture (isolated React components)
- Asset management (each game needs separate asset bundle)
- Local storage planning (larger footprint)
- Background downloads for new modules

**UX Consideration:**
- Single active game per location recommended (prevents choice paralysis)
- OR time-based rotation (morning = slot, afternoon = wheel)

### Phase 2: Loyalty & Personalization
**Goal:** Data-driven, personalized promotions

**Hardware Addition:** Barcode scanner (+$30 = ~$405 total)
**New Features:**
- **Loyalty Card Integration:** Tap once per day (not every play)
- **Anonymous Play Path:** Coins still work for non-loyalty members
- **Personalized Prizes:** "Brand wins" - prizes in categories shopper frequently buys
- **Mobile App Launch:** Rewards management, balance checking
- **Push Notifications:** "2x win chance if you visit by 6pm"
- **Ticket-to-Account Linking:** QR scan links to loyalty account
- **Two-Way Sync:** Kiosk queries loyalty data (Convex proxies Store API)

**Data Architecture:**
- Real-time OR cached loyalty data (depends on API availability)
- Prize targeting by purchase history
- Attribution tracking (ad view → purchase) for brands

**Business Model Enhancement:**
- Premium analytics for brands (attribution data)
- Loyalty data enrichment for stores

### Phase 3: Digital Transition
**Goal:** Full digital integration, mobile-first

**New Features:**
- **Native Wallet Passes:** Replace thermal tickets with phone wallet integration
- **Remote Play:** Possible (play from phone, claim in-store) - TBD
- **Full Digital Integration:** Mobile app = primary interface

---

## Key Decisions & Constraints

### Legal/Regulatory
- **Free Play Only:** No customer-paid play (avoids lottery/gambling regulations)
- **No Paid Tiers:** All games remain free
- **Prize Cap:** Hard daily limit on voucher value

### Product Philosophy
- **High Pass Rate:** 90% quiz pass rate (engagement > token conservation)
- **Urgency Engine:** 24-hour ticket expiration + "surprise" format = same-day redemption
- **Inclusive Design:** Anonymous path always available (coins)
- **Local Autonomy:** Store owners can adjust win rates for low-traffic locations

### Market Focus
- **Primary:** Belgium (French + Dutch language support)
- **Hardware:** Vertical screen orientation (Linux drivers configured)
- **Expansion:** Multi-language support enables broader European roll-out

### Technical Constraints
- **Quiz Library:** 10 unique questions (small set, enables cloud fetch)
- **Win Rate Formula:** TBD with client during deployment
- **Question Refresh:** Monthly/weekly/seasonal cadence (admin-controlled)
- **Offline Capability:** Must work during total network failure

---

## Success Metrics

### Phase 0 (MVP)
**Operational:**
- Uptime: 99%+
- Mean time between paper refills
- Network downtime impact: Zero (offline resilience)

**Engagement:**
- Plays per day per kiosk
- Average queue time (if people line up)
- Redemption rate: % of printed tickets actually used

**Business:**
- Incremental sales from ticket redemptions
- Customer dwell time increase in store
- Return visit rate (repeat players)

### Phase 1 (Multi-Game)
**Game Performance:**
- Plays per game type (slot vs wheel vs instant win)
- Game switch frequency (manual vs scheduled)
- Asset download success rate

**Ad Performance:**
- Impressions per brand (reel views)
- Video ad completion rates
- Brand engagement metrics

### Phase 2 (Loyalty)
**Loyalty Adoption:**
- % of plays using loyalty card vs coin
- Account linkage rate (QR tickets → accounts)
- Mobile app adoption

**Personalization Effectiveness:**
- Redemption rate: personalized vs generic prizes
- Attribution accuracy (ad view → purchase)
- Incremental revenue from targeted offers

---

## Risks & Mitigation

### Technical Risks
**Risk:** Offline sync conflicts
**Mitigation:** Kiosk is source of truth for inventory; server data is authoritative for configuration

**Risk:** Asset bloat with multiple games
**Mitigation:** Background downloads + asset cleanup for unused games

**Risk:** Barcode scanner latency
**Mitigation:** Cache loyalty data locally; fetch fresh in background

### Business Risks
**Risk:** Low ad sales initially
**Mitigation:** Bundle reel + video; offer discounts for longer contracts

**Risk:** Stores resist €250/month platform fee
**Mitigation:** Frame as operational expense; demonstrate ROI through foot traffic data

**Risk:** Lottery/gambling regulation scrutiny
**Mitigation:** Free play only; no customer payment; emphasize promotional nature

### UX Risks
**Risk:** Quiz frustration (wrong answers = lost token)
**Mitigation:** 90% pass rate; show correct answer; keep questions trivial

**Risk:** Ticket not redeemed (24-hour expiration too short)
**Mitigation:** Monitor redemption data; adjust expiration based on usage

**Risk:** Language barrier (FR/NL only)
**Mitigation:** Architecture supports multi-language; expand based on market

---

## Next Steps

### Immediate Actions
1. **Architecture Design:** Create technical blueprint for Phase 0 MVP
   - HAL (Hardware Abstraction Layer) specification
   - Game module interface design
   - Replicache + Convex integration architecture

2. **User Stories:** Break down Phase 0 into implementable tasks
   - Quiz question API design
   - Slot machine animation specs
   - Admin dashboard wireframes

3. **Tech Spec:** Detailed implementation plan for Phase 0
   - Database schema (SQLite local + Convex cloud)
   - API contracts (quiz fetch, game log push)
   - Security model (kiosk lockdown, admin RBAC)

### Future Considerations
- **Market Expansion:** Additional languages beyond FR/NL
- **Game Library:** Expand instant win game catalog
- **Mobile App:** Detailed UX for rewards management
- **Analytics Dashboard:** Advanced brand reporting features

---

## Brainstorming Technique Notes

**SCAMPER Method Applied:**
- **S - Substitute:** Coins → loyalty cards (Phase 2); slot → wheel (Phase 1)
- **C - Combine:** Ads + gameplay; casino + vending mechanics
- **A - Adapt:** Casinos (primary), vending machines (secondary); mobile games: daily rewards
- **M - Modify:** Entrance + checkout placement; QR codes on shelves → mobile
- **P - Put to other uses:** Survey kiosk, price checker, advertising surface
- **E - Eliminate:** No coin needed (QR start); no prizes (pure ad experience)
- **R - Reverse:** Rejected: Customer paid play (regulatory issues)

**Outcome:** SCAMPER efficiently generated 50+ ideas across 7 dimensions; we selected, refined, and prioritized into actionable roadmap.

---

**Session Status:** COMPLETE
**Techniques Used:** SCAMPER (Structured Thinking)
**Ideas Generated:** 50+ across substitute/combine/adapt/modify/put/eliminate/reverse
**Decisions Made:** 20+ concrete product decisions captured
**Artifacts Produced:** Phase 0 MVP spec, business model, Phase 1/2/3 roadmap

---

**Document Location:** `_bmad-output/analysis/brainstorming-session-2025-01-10.md`
**Summary Document:** `_bmad-output/analysis/brainstorming-session-2025-01-10-summary.md`

