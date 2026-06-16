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

export interface OutcomeStrategy {
  authority: 'local_backend';
  offline_required: true;
  selection: 'weighted_random';
  prizes: PrizeOutcome[];
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
