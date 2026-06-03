export type LocaleCode = string;

export type CampaignAssetType =
  | 'logo'
  | 'product'
  | 'background'
  | 'wheel-segment'
  | 'sound'
  | 'font'
  | 'reference';

export interface CampaignAsset {
  id: string;
  type: CampaignAssetType;
  label: string;
  src: string;
  usage: 'production' | 'prototype-reference' | 'placeholder';
  checksum?: string;
}

export interface WheelSegment {
  id: string;
  label: string;
  prizeId?: string;
  assetId?: string;
  color: string;
  weight: number;
}

export interface CampaignQuestion {
  id: string;
  locale: LocaleCode;
  prompt: string;
  options: Array<{ key: string; label: string }>;
  correctAnswerKey?: string;
}

export interface CampaignPrize {
  id: string;
  name: string;
  description: string;
  printLabel: string;
  dailyLimit?: number;
  totalLimit?: number;
}

export interface CampaignTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
}

export interface CampaignManifest {
  id: string;
  slug: string;
  name: string;
  brandName: string;
  gameTemplate: 'spin-wheel';
  defaultLocale: LocaleCode;
  status: 'draft' | 'active' | 'paused' | 'archived';
  copy: {
    attractHeadline: string;
    attractSubheadline: string;
    insertCoinCta: string;
    spinCta: string;
    questionIntro: string;
    prizeIntro: string;
    resetMessage: string;
  };
  theme: CampaignTheme;
  assets: CampaignAsset[];
  wheelSegments: WheelSegment[];
  questions: CampaignQuestion[];
  prizes: CampaignPrize[];
  legalNotes: string[];
}

export function assertCampaignManifest(manifest: CampaignManifest): CampaignManifest {
  if (!manifest.id || !manifest.slug || !manifest.name) {
    throw new Error('Campaign manifest requires id, slug, and name.');
  }
  if (manifest.gameTemplate !== 'spin-wheel') {
    throw new Error(`Unsupported game template: ${manifest.gameTemplate}`);
  }
  if (manifest.wheelSegments.length < 2) {
    throw new Error('Spin-wheel campaigns require at least two wheel segments.');
  }
  return manifest;
}
