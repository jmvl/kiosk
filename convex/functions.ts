import { v } from 'convex/values';
import { query, mutation } from './_generated/server';

// Example Convex functions - will be expanded during implementation

// Queries
export const getKioskConfig = query({
  args: {
    kioskId: v.string(),
  },
  handler: async (ctx, args) => {
    const kiosk = await ctx.db
      .query('kiosks')
      .withIndex('location', args.kioskId)
      .unique();

    if (!kiosk) {
      return null;
    }

    return kiosk.config;
  },
});

export const getGameResults = query({
  args: {
    kioskId: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query('gameResults')
      .withIndex('kioskId', args.kioskId)
      .take(args.limit);

    return results;
  },
});

// Mutations
export const recordGameResult = mutation({
  args: {
    kioskId: v.string(),
    outcome: v.union(v.literal('win'), v.literal('loss')),
    coinValue: v.number(),
    quizPassed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const resultId = await ctx.db.insert('gameResults', {
      kioskId: args.kioskId,
      timestamp: Date.now(),
      coinValue: args.coinValue,
      quizPassed: args.quizPassed,
      outcome: args.outcome,
      syncStatus: 'synced',
    });

    // Update inventory if win
    if (args.outcome === 'win') {
      const today = new Date().toISOString().split('T')[0];
      const inventory = await ctx.db
        .query('inventory')
        .withIndex('kioskDate', [args.kioskId, today])
        .unique();

      if (inventory && inventory.remainingBudget > 0) {
        await ctx.db.patch(inventory._id, {
          remainingBudget: inventory.remainingBudget - 1,
          lastUpdated: Date.now(),
        });
      }
    }

    return resultId;
  },
});

export const updateKioskConfig = mutation({
  args: {
    kioskId: v.string(),
    winRate: v.number(),
    dailyBudget: v.number(),
    language: v.union(v.literal('fr'), v.literal('nl')),
  },
  handler: async (ctx, args) => {
    const kiosk = await ctx.db
      .query('kiosks')
      .withIndex('location', args.kioskId)
      .unique();

    if (!kiosk) {
      throw new Error('Kiosk not found');
    }

    await ctx.db.patch(kiosk._id, {
      config: {
        winRate: args.winRate,
        dailyBudget: args.dailyBudget,
        language: args.language,
      },
    });

    return { success: true };
  },
});

export const recordAdImpression = mutation({
  args: {
    kioskId: v.string(),
    adId: v.string(),
    duration: v.number(),
  },
  handler: async (ctx, args) => {
    const impressionId = await ctx.db.insert('adImpressions', {
      kioskId: args.kioskId,
      adId: args.adId,
      timestamp: Date.now(),
      duration: args.duration,
      syncStatus: 'synced',
    });

    return impressionId;
  },
});
