---
stepsCompleted: [1, 2, 3]
inputDocuments: ["PRD: Gamified Supermarket Kiosk"]
session_topic: "Gamified Supermarket Kiosk - UX, Business Model, and Feature Expansion Brainstorming"
session_goals: "Generate ideas for (1) User Experience Enhancements, (2) Business Model Ideas, (3) Feature Expansion"
selected_approach: "User-Selected Techniques"
techniques_used: []
ideas_generated: []
context_file: ""
---

## Session Overview

**Topic:** Gamified Supermarket Kiosk - Interactive promotional kiosks with local-first architecture

**Goals:** 
- Generate user experience enhancements and engagement improvements
- Develop innovative business model and revenue ideas
- Explore creative feature expansion opportunities

### Context Guidance

**PRD Summary:**
- Modular kiosk platform with HAL (Hardware Abstraction Layer)
- Local-first architecture with Replicache/Convex sync
- Phase 0 MVP: Coin-operated quiz + slot game + thermal printer
- Phase 1: Remote management and ad rotation
- Phase 2: Loyalty integration with personalized prizes

Key technical constraints: 5G connectivity, offline resilience, React+Vite+Electron stack

### Session Setup

Facilitator: Jm
Date: 2025-01-10
Focus Areas: UX Innovation, Business Model Creativity, Feature Expansion

## Technique Execution: SCAMPER Method

### Direction 1: Loyalty Arcade
**Selected for Phase 0 MVP development**

**Key Ideas Generated:**
- Substitute coins → loyalty cards (Phase 2)
- Substitute slot machine → spin wheel (Phase 1 as additional option)
- Combine ads + gameplay for engagement
- Casino industry inspiration for UX
- Daily rewards mechanic for retention
- Entrance and checkout lane placement

**Phase 0 Refined Concept:**
- Core: Slot machine game (kept from original PRD)
- Trigger: Coin acceptor (today), loyalty card (Phase 2)
- Flow: Coin → Quiz → Slot Spin → Print Ticket
- Free play (no paid tiers - avoids lottery regulations)

**Phase 1 Evolution:**
- Add Wheel of Fortune as second game option
- Multi-game selection per kiosk via admin dashboard
- Remote game switching and theme management
- Game module architecture for future expansion

### SCAMPER Analysis Results

**S - Substitute:**
- Coins → Loyalty cards (Phase 2)
- Slot machine → Spin wheel (Phase 1)

**C - Combine:**
- Ads woven into gameplay loop
- Casino + vending machine mechanics

**A - Adapt:**
- Casino industry (primary)
- Vending machines (secondary)
- Mobile games: daily rewards

**M - Modify:**
- Location: entrance + checkout lanes
- Non-physical: QR codes on shelves → mobile experience

**P - Put to other uses:**
- Survey kiosk
- Price checker
- Advertising surface

**E - Eliminate:**
- No coin required: QR start or walk-up detection
- No prizes: pure ad experience

**R - Reverse:**
- Rejected: Customer paid play (regulatory issues)


### Phase 0 Decisions Confirmed

**Quiz Questions:**
- Fetched from cloud per game (not pre-loaded locally)
- Allows remote content updates without kiosk restart
- Enables seasonal campaigns and A/B testing

**Daily Voucher Budget:**
- Fully configurable by admin via dashboard
- No hard-coded limits
- Store managers can adjust per location based on traffic and budget

### Session Summary

**Technique Used:** SCAMPER Method (Structured Thinking)
**Focus Areas:** UX Enhancements, Business Models, Feature Expansion
**Key Outcome:** Direction 1 "Loyalty Arcade" selected for Phase 0 MVP
**Decisions Made:**
- Slot machine as core game (Phase 0)
- Wheel of Fortune added in Phase 1
- Multi-game architecture planned for Phase 1+
- Quiz questions cloud-fetched
- Daily budget admin-configurable
- Free play only (no paid tiers)

**Next Steps:** Architecture design, technical spec, or additional brainstorming


### UX Deep Dive Results

**Quiz Question Design:**
- Question library: 10 unique questions (small, focused set)
- Pass rate target: 90% (engagement priority over token conservation)
- Wrong answer behavior: Show correct answer, token always taken
- Question types: Mix of store facts, product trivia, seasonal/holiday questions

**Slot Machine Visuals:**
- Reel symbols: Product logos + generic symbols
- Revenue model: Product logo placement = paid advertising opportunity
- Branding: Heavily store-branded ("SUPERMART SPIN" aesthetic)
- Animation: Slow spin (3-4 seconds) for dramatic effect
- Win celebration: Confetti animation

**Ticket Redemption:**
- Ticket format: "Surprise" ticket (prize revealed when printed, not shown on screen)
- Expiration: 24 hours
- Checkout: Cashier scans OR self-scan options

**Accessibility & Hardware:**
- Screen: Fixed vertical orientation (Linux drivers configured)
- Audio: Optional sound effects (not required)
- Language: Multi-language support (French + Dutch)
- Input options: Coin OR QR code scan

**Additional Notes:**
- Small question library (10) enables cloud fetch with minimal latency
- High pass rate (90%) prioritizes customer experience over token cost
- Product logos on reels = ad revenue stream
- 24-hour expiration creates urgency to redeem same-day
- Vertical screen orientation = hardware constraint to work within
- FR/NL support suggests Belgian market target


### Business Model Deep Dive Results

**Ad Pricing Structure:**
- Reel logo placement: Fixed monthly fee per brand
- Ad inventory: 9 product logo slots (3 reels × 3 symbols)
- Video ads: Separate tier, available as monthly/weekly campaigns
- Brands can bundle reel + video placement

**Contract Terms:**
- Month-to-month: Standard pricing
- 3-month commitment: Discount applied
- 1-year commitment: 30% discount
- Flexible terms encourage longer partnerships

**Success Metrics & Reporting:**
- Primary metrics: Plays (brand exposure) + ticket redemptions (purchase intent)
- Real-time dashboard for advertisers (RBAC-controlled access)
- Brands can view their impressions and performance live
- Attribution tracking (logo view → actual purchase) planned for Phase 2

**Budget & Win Rate Management:**
- Win rate formula: To be determined with client during deployment
- Low-traffic stores: Shop owner can manually increase win odds
- High-performing stores: Contextual budget adjustments (depends on location performance)

**Revenue Streams:**
1. **Ad Sales:** Reel logo placement + video advertising
2. **Data Monetization:** Sell anonymized play data and insights to brands
   - Example: "Coca-Cola logo generates 30% more plays at 5pm"
   - Premium analytics tier for deeper insights

3. **Kiosk Placement Fee:** €250/month per kiosk to stores
   - Covers hardware, software, maintenance, support
   - Stores treat as operational expense

**Future Revenue Opportunities (Phase 2+):**
- Attribution analytics (link ad views to actual purchases via loyalty data)
- Premium insights packages for brands
- Dynamic pricing based on performance data
- Network-wide campaigns (all kiosks, premium pricing)

**Business Model Summary:**
- Triple-revenue model: Ads + Data + Platform fees
- Low risk: Month-to-month core, discounts for commitment
- High margin: Data monetization scales with network size
- Store owner autonomy: Local win rate control


### Phase 1/2 Feature Exploration Results

**Multi-Game Selection (Phase 1):**
- Game switching: Manual OR automated (scheduler-based)
- Transition UX: "Maintenance mode" screen during switch (not abrupt cut)
- Player experience: Invisible to shoppers (they don't choose which game)
- Admin permissions: RBAC-controlled (franchisee vs chain HQ mixed access)
- Game catalog expansion: Instant win games beyond Slot + Wheel

**Loyalty Integration (Phase 2):**
- Loyalty card tap: Once per day (not every play)
- Anonymous play: Non-loyalty members can still play with coins
- Ticket-to-account linking: If user scans QR ticket, link to loyalty account
- Personalization data: Depends on loyalty system API availability (real-time vs cached)
- Prize targeting: "Brand wins" - prizes in product categories shopper frequently buys

**Mobile Companion (Phase 2+):**
- Core purpose: Manage rewards, check balance (not remote play)
- Remote play: Not yet (maybe future phase)
- Push notifications: Yes (Phase 2) - e.g., "2x win chance if you visit by 6pm"
- Digital tickets: Phase 3 - native wallet passes replace thermal tickets

**Hardware Additions (Phase 2):**
- Barcode scanner (reading loyalty cards)

**Hardware Cost Breakdown (Per Kiosk):**
- Mini-PC (Linux): $150
- Thermal Printer: $75
- Barcode Scanner: $30
- Screen: $90
- 5G Network: $30
- **Total: ~$375 per kiosk**

**Phase Roadmap Summary:**

**Phase 0 (MVP):** $375 hardware
- Coin-only slot machine
- Cloud quiz questions
- One-way sync (kiosk → cloud)
- No loyalty integration

**Phase 1 (Multi-Game + Admin):** Same hardware
- Add Wheel of Fortune game
- Add Instant Win games
- Remote game selection via RBAC admin
- Scheduled or manual game switching
- Maintenance mode transitions

**Phase 2 (Loyalty + Personalization):** +$30 hardware (barcode scanner)
- Loyalty card tap integration
- Account-personalized prizes
- Mobile app (rewards management)
- Push notifications
- Ticket-to-account linking
- Real-time or cached loyalty data

**Phase 3 (Digital Transition):**
- Native wallet passes (replace thermal tickets)
- Possible remote play via mobile
- Full digital integration

**Key Decisions:**
- Coin path remains for anonymous play (inclusive)
- Loyalty tap once per day (frictionless)
- Brand-category targeting (personalized without being creepy)
- RBAC enables franchisee flexibility
- Hardware costs reasonable for scalability

