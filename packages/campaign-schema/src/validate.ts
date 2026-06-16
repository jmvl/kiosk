import {
  packageManifestRequiredFields,
  packageManifestSchemaVersion,
  type BridgeCapability,
  type PackageManifest,
  type PackageManifestFile,
  type PackageOrientation,
} from './manifest.js';

export interface ValidationIssue {
  path: string;
  message: string;
}

export type PackageManifestValidationResult =
  | { ok: true; manifest: PackageManifest; errors: [] }
  | { ok: false; errors: ValidationIssue[] };

const bridgeCapabilities = new Set<BridgeCapability>([
  'recordTelemetry',
  'requestPrint',
  'complete',
  'fail',
  'getScheduleContext',
  'getRuntimeCapabilities',
]);

const orientations = new Set<PackageOrientation>(['landscape', 'portrait']);
const fileRoles = new Set<PackageManifestFile['role']>([
  'entrypoint',
  'asset',
  'module',
  'ticket_template',
  'legal',
  'config',
]);

const semverPattern = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const packageIdPattern = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const safeRelativePathPattern = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function push(errors: ValidationIssue[], path: string, message: string): void {
  errors.push({ path, message });
}

function stringAt(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function numberAt(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function validateSafePath(value: unknown, path: string, errors: ValidationIssue[]): value is string {
  if (typeof value !== 'string' || value.length === 0) {
    push(errors, path, 'must be a non-empty relative path');
    return false;
  }
  if (!safeRelativePathPattern.test(value)) {
    push(errors, path, 'must be a safe relative path without .. segments');
    return false;
  }
  return true;
}

function validateFiles(value: unknown, entrypoint: string | undefined, errors: ValidationIssue[]): PackageManifestFile[] {
  if (!Array.isArray(value) || value.length === 0) {
    push(errors, 'files', 'must be a non-empty array');
    return [];
  }

  const files: PackageManifestFile[] = [];
  const seenPaths = new Set<string>();

  value.forEach((item, index) => {
    const base = `files[${index}]`;
    if (!isRecord(item)) {
      push(errors, base, 'must be an object');
      return;
    }

    const path = item.path;
    const size = item.size_bytes;
    const sha256 = item.sha256;
    const role = item.role;
    const mediaType = item.media_type;

    const pathIsValid = validateSafePath(path, `${base}.path`, errors);
    if (pathIsValid) {
      if (seenPaths.has(path)) {
        push(errors, `${base}.path`, 'must be unique');
      }
      seenPaths.add(path);
    }

    if (typeof size !== 'number' || !Number.isInteger(size) || size < 0) {
      push(errors, `${base}.size_bytes`, 'must be a non-negative integer');
    }
    if (typeof sha256 !== 'string' || !sha256Pattern.test(sha256)) {
      push(errors, `${base}.sha256`, 'must be a lowercase hex SHA-256 digest');
    }
    if (typeof role !== 'string' || !fileRoles.has(role as PackageManifestFile['role'])) {
      push(errors, `${base}.role`, 'must be a known file role');
    }
    if (mediaType !== undefined && typeof mediaType !== 'string') {
      push(errors, `${base}.media_type`, 'must be a string when present');
    }

    if (pathIsValid && typeof size === 'number' && Number.isInteger(size) && size >= 0 && typeof sha256 === 'string' && sha256Pattern.test(sha256) && typeof role === 'string' && fileRoles.has(role as PackageManifestFile['role'])) {
      const file: PackageManifestFile = { path, size_bytes: size, sha256, role: role as PackageManifestFile['role'] };
      if (typeof mediaType === 'string') {
        file.media_type = mediaType;
      }
      files.push(file);
    }
  });

  if (entrypoint !== undefined && !seenPaths.has(entrypoint)) {
    push(errors, 'entrypoint', 'must appear in files');
  }

  return files;
}

function hasFileWithRole(files: PackageManifestFile[], path: string, role: PackageManifestFile['role']): boolean {
  return files.some((file) => file.path === path && file.role === role);
}

function validateOutcomeStrategy(value: unknown, errors: ValidationIssue[]): PackageManifest['outcome_strategy'] {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    push(errors, 'outcome_strategy', 'must be an object when present');
    return undefined;
  }

  if (value.authority !== 'local_backend') {
    push(errors, 'outcome_strategy.authority', 'must be local_backend for offline hybrid campaigns');
  }
  if (value.offline_required !== true) {
    push(errors, 'outcome_strategy.offline_required', 'must be true so kiosk outcomes work without internet');
  }
  if (value.selection !== 'weighted_random') {
    push(errors, 'outcome_strategy.selection', 'must be weighted_random');
  }
  if (!Array.isArray(value.prizes) || value.prizes.length === 0) {
    push(errors, 'outcome_strategy.prizes', 'must be a non-empty array');
    return undefined;
  }

  const prizes: NonNullable<PackageManifest['outcome_strategy']>['prizes'] = [];
  const seenPrizeIds = new Set<string>();
  value.prizes.forEach((prize, index) => {
    const base = `outcome_strategy.prizes[${index}]`;
    if (!isRecord(prize)) {
      push(errors, base, 'must be an object');
      return;
    }
    const prizeId = stringAt(prize, 'prize_id');
    const label = stringAt(prize, 'label');
    const weight = numberAt(prize, 'weight');
    const maxWins = numberAt(prize, 'max_wins_per_package');

    if (prizeId === undefined || !packageIdPattern.test(prizeId)) {
      push(errors, `${base}.prize_id`, 'must be kebab-case, 3-64 chars');
    } else if (seenPrizeIds.has(prizeId)) {
      push(errors, `${base}.prize_id`, 'must be unique');
    } else {
      seenPrizeIds.add(prizeId);
    }
    if (label === undefined || label.trim().length === 0) {
      push(errors, `${base}.label`, 'must be a non-empty string');
    }
    if (weight === undefined || !Number.isInteger(weight) || weight <= 0) {
      push(errors, `${base}.weight`, 'must be a positive integer');
    }
    if (prize.max_wins_per_package !== undefined && (maxWins === undefined || !Number.isInteger(maxWins) || maxWins <= 0)) {
      push(errors, `${base}.max_wins_per_package`, 'must be a positive integer when present');
    }
    if (prizeId !== undefined && label !== undefined && weight !== undefined && Number.isInteger(weight) && weight > 0) {
      const normalizedPrize: NonNullable<PackageManifest['outcome_strategy']>['prizes'][number] = { prize_id: prizeId, label, weight };
      if (maxWins !== undefined && Number.isInteger(maxWins) && maxWins > 0) {
        normalizedPrize.max_wins_per_package = maxWins;
      }
      prizes.push(normalizedPrize);
    }
  });

  if (value.authority === 'local_backend' && value.offline_required === true && value.selection === 'weighted_random' && prizes.length > 0) {
    return { authority: 'local_backend', offline_required: true, selection: 'weighted_random', prizes };
  }
  return undefined;
}

export function validatePackageManifest(input: unknown): PackageManifestValidationResult {
  const errors: ValidationIssue[] = [];

  if (!isRecord(input)) {
    return { ok: false, errors: [{ path: '$', message: 'manifest must be an object' }] };
  }

  for (const field of packageManifestRequiredFields) {
    if (!(field in input)) {
      push(errors, field, 'is required');
    }
  }

  if (input.schema_version !== packageManifestSchemaVersion) {
    push(errors, 'schema_version', `must equal ${packageManifestSchemaVersion}`);
  }

  const packageId = stringAt(input, 'package_id');
  if (packageId === undefined || !packageIdPattern.test(packageId)) {
    push(errors, 'package_id', 'must be kebab-case, 3-64 chars');
  }

  const version = stringAt(input, 'version');
  if (version === undefined || !semverPattern.test(version)) {
    push(errors, 'version', 'must be semver');
  }

  const displayName = stringAt(input, 'display_name');
  if (displayName === undefined || displayName.trim().length === 0) {
    push(errors, 'display_name', 'must be a non-empty string');
  }

  const runtimeContractVersion = stringAt(input, 'runtime_contract_version');
  if (runtimeContractVersion === undefined || runtimeContractVersion.trim().length === 0) {
    push(errors, 'runtime_contract_version', 'must be a non-empty string');
  }

  const minRuntimeVersion = stringAt(input, 'min_runtime_version');
  if (minRuntimeVersion === undefined || !semverPattern.test(minRuntimeVersion)) {
    push(errors, 'min_runtime_version', 'must be semver');
  }

  const minPlayerVersion = stringAt(input, 'min_player_version');
  if (minPlayerVersion === undefined || !semverPattern.test(minPlayerVersion)) {
    push(errors, 'min_player_version', 'must be semver');
  }

  const orientation = stringAt(input, 'orientation');
  if (orientation === undefined || !orientations.has(orientation as PackageOrientation)) {
    push(errors, 'orientation', 'must be landscape or portrait');
  }

  let width: number | undefined;
  let height: number | undefined;
  if (!isRecord(input.resolution)) {
    push(errors, 'resolution', 'must be an object');
  } else {
    width = numberAt(input.resolution, 'width');
    height = numberAt(input.resolution, 'height');
    if (width === undefined || !Number.isInteger(width) || width <= 0) {
      push(errors, 'resolution.width', 'must be a positive integer');
    }
    if (height === undefined || !Number.isInteger(height) || height <= 0) {
      push(errors, 'resolution.height', 'must be a positive integer');
    }
  }

  const entrypoint = stringAt(input, 'entrypoint');
  const entrypointIsValid = validateSafePath(entrypoint, 'entrypoint', errors);
  if (!entrypointIsValid) {
    // keep collecting file errors
  }

  const capabilities: BridgeCapability[] = [];
  if (!Array.isArray(input.bridge_capabilities) || input.bridge_capabilities.length === 0) {
    push(errors, 'bridge_capabilities', 'must be a non-empty array');
  } else {
    input.bridge_capabilities.forEach((capability, index) => {
      if (typeof capability !== 'string' || !bridgeCapabilities.has(capability as BridgeCapability)) {
        push(errors, `bridge_capabilities[${index}]`, 'must be an allowed bridge capability');
        return;
      }
      capabilities.push(capability as BridgeCapability);
    });
  }

  const files = validateFiles(input.files, entrypoint, errors);
  if (entrypointIsValid && !hasFileWithRole(files, entrypoint, 'entrypoint')) {
    push(errors, 'entrypoint', 'must appear in files with role entrypoint');
  }

  const campaignShortCode = stringAt(input, 'campaign_short_code');
  if (campaignShortCode !== undefined && !/^[A-Z0-9]{2,8}$/.test(campaignShortCode)) {
    push(errors, 'campaign_short_code', 'must be 2-8 uppercase letters/digits when present');
  }

  let ticketTemplate: PackageManifest['ticket_template'];
  if (input.ticket_template !== undefined) {
    if (!isRecord(input.ticket_template)) {
      push(errors, 'ticket_template', 'must be an object when present');
    } else {
      const templatePath = input.ticket_template.path;
      const qrEnabled = input.ticket_template.qr_enabled;
      const templatePathIsValid = validateSafePath(templatePath, 'ticket_template.path', errors);
      const templatePathIsListed = templatePathIsValid && hasFileWithRole(files, templatePath, 'ticket_template');
      if (templatePathIsValid && !templatePathIsListed) {
        push(errors, 'ticket_template.path', 'must appear in files with role ticket_template');
      }
      if (templatePathIsListed && typeof qrEnabled === 'boolean') {
        ticketTemplate = { path: templatePath, qr_enabled: qrEnabled };
      }
      if (typeof qrEnabled !== 'boolean') {
        push(errors, 'ticket_template.qr_enabled', 'must be boolean');
      }
    }
  }

  let legal: PackageManifest['legal'];
  const outcomeStrategy = validateOutcomeStrategy(input.outcome_strategy, errors);

  if (input.legal !== undefined) {
    if (!isRecord(input.legal)) {
      push(errors, 'legal', 'must be an object when present');
    } else {
      legal = {};
      for (const field of ['terms_path', 'privacy_path'] as const) {
        const legalPath = input.legal[field];
        if (legalPath === undefined) {
          continue;
        }
        if (validateSafePath(legalPath, `legal.${field}`, errors)) {
          if (!hasFileWithRole(files, legalPath, 'legal')) {
            push(errors, `legal.${field}`, 'must appear in files with role legal');
          } else {
            legal[field] = legalPath;
          }
        }
      }
    }
  }

  const packageSizeLimit = numberAt(input, 'package_size_limit_bytes');
  if (input.package_size_limit_bytes !== undefined && (packageSizeLimit === undefined || !Number.isInteger(packageSizeLimit) || packageSizeLimit <= 0)) {
    push(errors, 'package_size_limit_bytes', 'must be a positive integer when present');
  }
  if (packageSizeLimit !== undefined && Number.isInteger(packageSizeLimit) && packageSizeLimit > 0) {
    const totalFileSize = files.reduce((total, file) => total + file.size_bytes, 0);
    if (totalFileSize > packageSizeLimit) {
      push(errors, 'package_size_limit_bytes', 'must be greater than or equal to total file size_bytes');
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const manifest: PackageManifest = {
    schema_version: packageManifestSchemaVersion,
    package_id: packageId as string,
    version: version as string,
    display_name: displayName as string,
    runtime_contract_version: runtimeContractVersion as string,
    min_runtime_version: minRuntimeVersion as string,
    min_player_version: minPlayerVersion as string,
    orientation: orientation as PackageOrientation,
    resolution: { width: width as number, height: height as number },
    bridge_capabilities: capabilities,
    entrypoint: entrypoint as string,
    files,
  };

  if (campaignShortCode !== undefined) {
    manifest.campaign_short_code = campaignShortCode;
  }
  if (ticketTemplate !== undefined) {
    manifest.ticket_template = ticketTemplate;
  }
  if (outcomeStrategy !== undefined) {
    manifest.outcome_strategy = outcomeStrategy;
  }
  if (legal !== undefined && (legal.terms_path !== undefined || legal.privacy_path !== undefined)) {
    manifest.legal = legal;
  }
  if (packageSizeLimit !== undefined) {
    manifest.package_size_limit_bytes = packageSizeLimit;
  }

  return { ok: true, manifest, errors: [] };
}
