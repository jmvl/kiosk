export const packageManifestSchemaVersion = 1;

export const packageManifestRequiredFields = [
  'schema_version',
  'package_id',
  'version',
  'display_name',
  'runtime_contract_version',
  'min_runtime_version',
  'min_player_version',
  'orientation',
  'resolution',
  'bridge_capabilities',
  'entrypoint',
  'files',
] as const;

export const requiredCampaignLocales = ['fr-BE', 'nl-BE'] as const;

export type RequiredCampaignLocale = (typeof requiredCampaignLocales)[number];

export type LocalizedCopy = Record<RequiredCampaignLocale, string>;

export type PackageOrientation = 'landscape' | 'portrait';

export type BridgeCapability =
  | 'recordTelemetry'
  | 'requestPrint'
  | 'complete'
  | 'fail'
  | 'getScheduleContext'
  | 'getRuntimeCapabilities';

export interface PackageManifestFile {
  path: string;
  size_bytes: number;
  sha256: string;
  media_type?: string;
  role: 'entrypoint' | 'asset' | 'module' | 'ticket_template' | 'legal' | 'config';
}

export interface PrizeOutcome {
  prize_id: string;
  label: string;
  weight: number;
  max_wins_per_package?: number;
}

export interface CampaignQuizChoice {
  choice_id: string;
  label: LocalizedCopy;
  correct: boolean;
}

export interface CampaignQuiz {
  question: LocalizedCopy;
  choices: CampaignQuizChoice[];
  attempt_limit: number;
  retry_copy?: LocalizedCopy;
  failed_copy?: LocalizedCopy;
}

export type CampaignOutcomeType = 'win' | 'loss' | 'consolation' | 'grand_prize' | 'custom';

export interface CampaignOutcome {
  outcome_id: string;
  outcome_type: CampaignOutcomeType;
  active: boolean;
  localized_label: LocalizedCopy;
  weight: number;
  inventory_cap?: number;
  daily_cap?: number;
  print_ticket: boolean;
  ticket_template_id?: string;
  bitmap_asset_id?: string;
  qr_payload_template?: string;
  approved_qr_payload_equivalent?: string;
  cashier_instruction: LocalizedCopy;
  terms: LocalizedCopy;
}

export interface CampaignTicketTemplate {
  template_id: string;
  path: string;
  bitmap_asset_id?: string;
}

export interface CampaignBitmapAsset {
  asset_id: string;
  path: string;
}

export interface VisualWheelSegment {
  segment_id: string;
  outcome_id: string;
  bitmap_asset_id?: string;
  localized_label?: LocalizedCopy;
}

export interface VisualWheelMapping {
  segments: VisualWheelSegment[];
}

export interface OutcomeStrategy {
  authority: 'local_backend';
  offline_required: true;
  selection: 'weighted_random';
  prizes?: PrizeOutcome[];
  outcomes?: CampaignOutcome[];
}

export interface PackageManifest {
  schema_version: typeof packageManifestSchemaVersion;
  package_id: string;
  version: string;
  display_name: string;
  campaign_short_code?: string;
  runtime_contract_version: string;
  min_runtime_version: string;
  min_player_version: string;
  orientation: PackageOrientation;
  resolution: {
    width: number;
    height: number;
  };
  bridge_capabilities: BridgeCapability[];
  entrypoint: string;
  files: PackageManifestFile[];
  ticket_template?: {
    path: string;
    qr_enabled: boolean;
  };
  quiz?: CampaignQuiz;
  ticket_templates?: CampaignTicketTemplate[];
  bitmap_assets?: CampaignBitmapAsset[];
  visual_wheel?: VisualWheelMapping;
  outcome_strategy?: OutcomeStrategy;
  legal?: {
    terms_path?: string;
    privacy_path?: string;
  };
  package_size_limit_bytes?: number;
  signature?: {
    algorithm: 'ed25519';
    key_id: string;
    signature: string;
  };
}
