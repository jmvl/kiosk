import { defineSchema, defineTable } from 'convex/server';

// Convex Schema Definition
// This will be expanded as we implement stories

export default defineSchema({
  // Kiosks collection - stores kiosk configuration and status
  kiosks: defineTable({
    name: v.string(),
    location: v.string(),
    status: v.union(v.literal('online'), v.literal('offline'), v.literal('error')),
    lastSeen: v.number(),
    config: v.object({
      winRate: v.number(),
      dailyBudget: v.number(),
      language: v.union(v.literal('fr'), v.literal('nl')),
    }),
  })
    .index('status', ['status'])
    .index('location', ['location']),

  // Game results collection - stores all game sessions
  gameResults: defineTable({
    kioskId: v.string(),
    timestamp: v.number(),
    coinValue: v.number(),
    quizPassed: v.boolean(),
    outcome: v.union(v.literal('win'), v.literal('loss')),
    prizeValue: v.optional(v.number()),
    qrCode: v.optional(v.string()),
    syncStatus: v.union(v.literal('pending'), v.literal('synced'), v.literal('failed')),
  })
    .index('kioskId', ['kioskId'])
    .index('timestamp', ['timestamp']),

  // Ad impressions collection - tracks ad views
  adImpressions: defineTable({
    kioskId: v.string(),
    adId: v.string(),
    timestamp: v.number(),
    duration: v.number(),
    syncStatus: v.union(v.literal('pending'), v.literal('synced'), v.literal('failed')),
  })
    .index('kioskId', ['kioskId'])
    .index('adId', ['adId']),

  // Quiz questions collection
  quizQuestions: defineTable({
    question: v.object({
      fr: v.string(),
      nl: v.string(),
    }),
    answers: v.object({
      fr: v.array(v.string()),
      nl: v.array(v.string()),
    }),
    correctAnswer: v.number(),
    active: v.boolean(),
  }),

  // Admin users collection (RBAC)
  adminUsers: defineTable({
    email: v.string(),
    role: v.union(
      v.literal('chain_hq'),
      v.literal('regional_manager'),
      v.literal('store_owner'),
      v.literal('brand_advertiser')
    ),
    name: v.string(),
    active: v.boolean(),
  })
    .index('email', ['email']),

  // Ad campaigns collection
  adCampaigns: defineTable({
    name: v.string(),
    videoUrl: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    targetKiosks: v.array(v.string()), // Array of kiosk IDs
    createdBy: v.string(), // Admin user email
    active: v.boolean(),
  })
    .index('active', ['active', 'startDate']),

  // Inventory tracking collection (kiosk as source of truth)
  inventory: defineTable({
    kioskId: v.string(),
    date: v.string(), // YYYY-MM-DD format
    initialBudget: v.number(),
    remainingBudget: v.number(),
    lastUpdated: v.number(),
  })
    .index('kioskDate', ['kioskId', 'date']),
});
