import {
  packageManifestRequiredFields,
  packageManifestSchemaVersion,
  requiredCampaignLocales,
  type BridgeCapability,
  type CampaignBitmapAsset,
  type CampaignOutcome,
  type CampaignOutcomeType,
  type CampaignQuiz,
  type CampaignTicketTemplate,
  type LocalizedCopy,
  type PackageManifest,
  type PackageManifestFile,
  type PackageOrientation,
  type PrizeOutcome,
  type VisualWheelMapping,
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
const outcomeTypes = new Set<CampaignOutcomeType>(['win', 'loss', 'consolation', 'grand_prize', 'custom']);

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

function validateLocalizedCopy(value: unknown, path: string, errors: ValidationIssue[]): LocalizedCopy | undefined {
  if (!isRecord(value)) {
    push(errors, path, 'must be an object with fr-BE and nl-BE copy');
    return undefined;
  }

  const copy: Partial<LocalizedCopy> = {};
  for (const locale of requiredCampaignLocales) {
    const localeValue = value[locale];
    if (typeof localeValue !== 'string' || localeValue.trim().length === 0) {
      push(errors, `${path}.${locale}`, 'must be a non-empty localized string');
      continue;
    }
    copy[locale] = localeValue;
  }
  return requiredCampaignLocales.every((locale) => copy[locale] !== undefined) ? copy as LocalizedCopy : undefined;
}

function validatePositiveInteger(value: unknown, path: string, errors: ValidationIssue[], required = true): number | undefined {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    push(errors, path, 'must be a positive integer');
    return undefined;
  }
  return value;
}

function validateId(value: unknown, path: string, errors: ValidationIssue[], label = 'id'): string | undefined {
  if (typeof value !== 'string' || !packageIdPattern.test(value)) {
    push(errors, path, `must be kebab-case ${label}, 3-64 chars`);
    return undefined;
  }
  return value;
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

function validateQuiz(value: unknown, errors: ValidationIssue[]): CampaignQuiz | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    push(errors, 'quiz', 'must be an object when present');
    return undefined;
  }

  const question = validateLocalizedCopy(value.question, 'quiz.question', errors);
  const attemptLimit = value.attempt_limit === undefined ? 2 : validatePositiveInteger(value.attempt_limit, 'quiz.attempt_limit', errors);
  const retryCopy = value.retry_copy === undefined ? undefined : validateLocalizedCopy(value.retry_copy, 'quiz.retry_copy', errors);
  const failedCopy = value.failed_copy === undefined ? undefined : validateLocalizedCopy(value.failed_copy, 'quiz.failed_copy', errors);

  if (!Array.isArray(value.choices)) {
    push(errors, 'quiz.choices', 'must contain exactly 3 choices');
    return undefined;
  }
  if (value.choices.length !== 3) {
    push(errors, 'quiz.choices', 'must contain exactly 3 choices');
  }

  const choices: CampaignQuiz['choices'] = [];
  const seenChoiceIds = new Set<string>();
  let correctCount = 0;
  value.choices.forEach((choice, index) => {
    const base = `quiz.choices[${index}]`;
    if (!isRecord(choice)) {
      push(errors, base, 'must be an object');
      return;
    }
    const choiceId = validateId(choice.choice_id, `${base}.choice_id`, errors, 'choice id');
    if (choiceId !== undefined) {
      if (seenChoiceIds.has(choiceId)) {
        push(errors, `${base}.choice_id`, 'must be unique');
      }
      seenChoiceIds.add(choiceId);
    }
    const label = validateLocalizedCopy(choice.label, `${base}.label`, errors);
    if (typeof choice.correct !== 'boolean') {
      push(errors, `${base}.correct`, 'must be boolean');
    } else if (choice.correct) {
      correctCount += 1;
    }
    if (choiceId !== undefined && label !== undefined && typeof choice.correct === 'boolean') {
      choices.push({ choice_id: choiceId, label, correct: choice.correct });
    }
  });
  if (correctCount !== 1) {
    push(errors, 'quiz.choices', 'must contain exactly 1 correct answer');
  }

  if (question === undefined || attemptLimit === undefined || choices.length !== 3 || correctCount !== 1) {
    return undefined;
  }
  const quiz: CampaignQuiz = { question, choices, attempt_limit: attemptLimit };
  if (retryCopy !== undefined) quiz.retry_copy = retryCopy;
  if (failedCopy !== undefined) quiz.failed_copy = failedCopy;
  return quiz;
}

function validateBitmapAssets(value: unknown, files: PackageManifestFile[], errors: ValidationIssue[]): CampaignBitmapAsset[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    push(errors, 'bitmap_assets', 'must be an array when present');
    return undefined;
  }
  const assets: CampaignBitmapAsset[] = [];
  const seenIds = new Set<string>();
  value.forEach((asset, index) => {
    const base = `bitmap_assets[${index}]`;
    if (!isRecord(asset)) {
      push(errors, base, 'must be an object');
      return;
    }
    const assetId = validateId(asset.asset_id, `${base}.asset_id`, errors, 'asset id');
    if (assetId !== undefined) {
      if (seenIds.has(assetId)) push(errors, `${base}.asset_id`, 'must be unique');
      seenIds.add(assetId);
    }
    const assetPath = asset.path;
    const pathIsValid = validateSafePath(assetPath, `${base}.path`, errors);
    if (pathIsValid && !hasFileWithRole(files, assetPath, 'asset')) {
      push(errors, `${base}.path`, 'must appear in files with role asset');
    }
    if (assetId !== undefined && pathIsValid && hasFileWithRole(files, assetPath, 'asset')) {
      assets.push({ asset_id: assetId, path: assetPath });
    }
  });
  return assets;
}

function validateTicketTemplates(value: unknown, files: PackageManifestFile[], bitmapAssetIds: Set<string>, errors: ValidationIssue[]): CampaignTicketTemplate[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    push(errors, 'ticket_templates', 'must be an array when present');
    return undefined;
  }
  const templates: CampaignTicketTemplate[] = [];
  const seenIds = new Set<string>();
  value.forEach((template, index) => {
    const base = `ticket_templates[${index}]`;
    if (!isRecord(template)) {
      push(errors, base, 'must be an object');
      return;
    }
    const templateId = validateId(template.template_id, `${base}.template_id`, errors, 'template id');
    if (templateId !== undefined) {
      if (seenIds.has(templateId)) push(errors, `${base}.template_id`, 'must be unique');
      seenIds.add(templateId);
    }
    const templatePath = template.path;
    const pathIsValid = validateSafePath(templatePath, `${base}.path`, errors);
    if (pathIsValid && !hasFileWithRole(files, templatePath, 'ticket_template')) {
      push(errors, `${base}.path`, 'must appear in files with role ticket_template');
    }
    const bitmapAssetId = stringAt(template, 'bitmap_asset_id');
    if (bitmapAssetId !== undefined && !bitmapAssetIds.has(bitmapAssetId)) {
      push(errors, `${base}.bitmap_asset_id`, 'must reference bitmap_assets.asset_id');
    }
    if (templateId !== undefined && pathIsValid && hasFileWithRole(files, templatePath, 'ticket_template')) {
      const normalized: CampaignTicketTemplate = { template_id: templateId, path: templatePath };
      if (bitmapAssetId !== undefined && bitmapAssetIds.has(bitmapAssetId)) normalized.bitmap_asset_id = bitmapAssetId;
      templates.push(normalized);
    }
  });
  return templates;
}

function validateOutcomeStrategy(value: unknown, ticketTemplateIds: Set<string>, bitmapAssetIds: Set<string>, errors: ValidationIssue[]): PackageManifest['outcome_strategy'] {
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

  const prizes = validateLegacyPrizes(value.prizes, errors);
  const outcomes = validateCampaignOutcomes(value.outcomes, ticketTemplateIds, bitmapAssetIds, errors);
  if ((prizes === undefined || prizes.length === 0) && (outcomes === undefined || outcomes.length === 0)) {
    push(errors, 'outcome_strategy', 'must include non-empty prizes or outcomes');
  }

  if (value.authority === 'local_backend' && value.offline_required === true && value.selection === 'weighted_random' && ((prizes !== undefined && prizes.length > 0) || (outcomes !== undefined && outcomes.length > 0))) {
    const strategy: NonNullable<PackageManifest['outcome_strategy']> = { authority: 'local_backend', offline_required: true, selection: 'weighted_random' };
    if (prizes !== undefined && prizes.length > 0) strategy.prizes = prizes;
    if (outcomes !== undefined && outcomes.length > 0) strategy.outcomes = outcomes;
    return strategy;
  }
  return undefined;
}

function validateLegacyPrizes(value: unknown, errors: ValidationIssue[]): NonNullable<PackageManifest['outcome_strategy']>['prizes'] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0) {
    push(errors, 'outcome_strategy.prizes', 'must be a non-empty array when present');
    return undefined;
  }

  const prizes: NonNullable<PackageManifest['outcome_strategy']>['prizes'] = [];
  const seenPrizeIds = new Set<string>();
  value.forEach((prize, index) => {
    const base = `outcome_strategy.prizes[${index}]`;
    if (!isRecord(prize)) {
      push(errors, base, 'must be an object');
      return;
    }
    const prizeId = validateId(prize.prize_id, `${base}.prize_id`, errors, 'prize id');
    const label = stringAt(prize, 'label');
    const weight = validatePositiveInteger(prize.weight, `${base}.weight`, errors);
    const maxWins = validatePositiveInteger(prize.max_wins_per_package, `${base}.max_wins_per_package`, errors, false);

    if (prizeId !== undefined) {
      if (seenPrizeIds.has(prizeId)) push(errors, `${base}.prize_id`, 'must be unique');
      seenPrizeIds.add(prizeId);
    }
    if (label === undefined || label.trim().length === 0) {
      push(errors, `${base}.label`, 'must be a non-empty string');
    }
    if (prizeId !== undefined && label !== undefined && label.trim().length > 0 && weight !== undefined) {
      const normalizedPrize: PrizeOutcome = { prize_id: prizeId, label, weight };
      if (maxWins !== undefined) normalizedPrize.max_wins_per_package = maxWins;
      prizes.push(normalizedPrize);
    }
  });
  return prizes;
}

function validateCampaignOutcomes(value: unknown, ticketTemplateIds: Set<string>, bitmapAssetIds: Set<string>, errors: ValidationIssue[]): CampaignOutcome[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0) {
    push(errors, 'outcome_strategy.outcomes', 'must be a non-empty array when present');
    return undefined;
  }
  const outcomes: CampaignOutcome[] = [];
  const seenOutcomeIds = new Set<string>();
  value.forEach((outcome, index) => {
    const base = `outcome_strategy.outcomes[${index}]`;
    if (!isRecord(outcome)) {
      push(errors, base, 'must be an object');
      return;
    }
    const outcomeId = validateId(outcome.outcome_id, `${base}.outcome_id`, errors, 'outcome id');
    if (outcomeId !== undefined) {
      if (seenOutcomeIds.has(outcomeId)) push(errors, `${base}.outcome_id`, 'must be unique');
      seenOutcomeIds.add(outcomeId);
    }
    const outcomeType = stringAt(outcome, 'outcome_type');
    if (outcomeType === undefined || !outcomeTypes.has(outcomeType as CampaignOutcomeType)) {
      push(errors, `${base}.outcome_type`, 'must be win, loss, consolation, grand_prize, or custom');
    }
    const active = outcome.active;
    if (typeof active !== 'boolean') {
      push(errors, `${base}.active`, 'must be boolean');
    }
    const localizedLabel = validateLocalizedCopy(outcome.localized_label, `${base}.localized_label`, errors);
    const weight = validatePositiveInteger(outcome.weight, `${base}.weight`, errors);
    const inventoryCap = validatePositiveInteger(outcome.inventory_cap, `${base}.inventory_cap`, errors, false);
    const dailyCap = validatePositiveInteger(outcome.daily_cap, `${base}.daily_cap`, errors, false);
    const printTicket = outcome.print_ticket;
    if (typeof printTicket !== 'boolean') {
      push(errors, `${base}.print_ticket`, 'must be boolean');
    }
    const cashierInstruction = validateLocalizedCopy(outcome.cashier_instruction, `${base}.cashier_instruction`, errors);
    const terms = validateLocalizedCopy(outcome.terms, `${base}.terms`, errors);

    const ticketTemplateId = stringAt(outcome, 'ticket_template_id');
    if (ticketTemplateId !== undefined && !ticketTemplateIds.has(ticketTemplateId)) {
      push(errors, `${base}.ticket_template_id`, 'must reference ticket_templates.template_id');
    }
    const bitmapAssetId = stringAt(outcome, 'bitmap_asset_id');
    if (bitmapAssetId !== undefined && !bitmapAssetIds.has(bitmapAssetId)) {
      push(errors, `${base}.bitmap_asset_id`, 'must reference bitmap_assets.asset_id');
    }
    const qrPayloadTemplate = stringAt(outcome, 'qr_payload_template');
    const approvedEquivalent = stringAt(outcome, 'approved_qr_payload_equivalent');
    if (printTicket === true) {
      if (ticketTemplateId === undefined) push(errors, `${base}.ticket_template_id`, 'is required when print_ticket is true');
      if (qrPayloadTemplate === undefined || qrPayloadTemplate.trim().length === 0) {
        push(errors, `${base}.qr_payload_template`, 'is required when print_ticket is true');
      } else if (!qrPayloadTemplate.includes('{{ticket_code}}') && (approvedEquivalent === undefined || approvedEquivalent.trim().length === 0)) {
        push(errors, `${base}.qr_payload_template`, 'must include {{ticket_code}} or approved_qr_payload_equivalent');
      }
    }

    if (outcomeId !== undefined && outcomeType !== undefined && outcomeTypes.has(outcomeType as CampaignOutcomeType) && typeof active === 'boolean' && localizedLabel !== undefined && weight !== undefined && typeof printTicket === 'boolean' && cashierInstruction !== undefined && terms !== undefined) {
      const normalized: CampaignOutcome = {
        outcome_id: outcomeId,
        outcome_type: outcomeType as CampaignOutcomeType,
        active,
        localized_label: localizedLabel,
        weight,
        print_ticket: printTicket,
        cashier_instruction: cashierInstruction,
        terms,
      };
      if (inventoryCap !== undefined) normalized.inventory_cap = inventoryCap;
      if (dailyCap !== undefined) normalized.daily_cap = dailyCap;
      if (ticketTemplateId !== undefined && ticketTemplateIds.has(ticketTemplateId)) normalized.ticket_template_id = ticketTemplateId;
      if (bitmapAssetId !== undefined && bitmapAssetIds.has(bitmapAssetId)) normalized.bitmap_asset_id = bitmapAssetId;
      if (qrPayloadTemplate !== undefined) normalized.qr_payload_template = qrPayloadTemplate;
      if (approvedEquivalent !== undefined) normalized.approved_qr_payload_equivalent = approvedEquivalent;
      outcomes.push(normalized);
    }
  });
  return outcomes;
}

function validateVisualWheel(value: unknown, outcomeIds: Set<string>, bitmapAssetIds: Set<string>, errors: ValidationIssue[]): VisualWheelMapping | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    push(errors, 'visual_wheel', 'must be an object when present');
    return undefined;
  }
  if (!Array.isArray(value.segments) || value.segments.length === 0) {
    push(errors, 'visual_wheel.segments', 'must be a non-empty array');
    return undefined;
  }
  const segments: VisualWheelMapping['segments'] = [];
  const seenSegmentIds = new Set<string>();
  value.segments.forEach((segment, index) => {
    const base = `visual_wheel.segments[${index}]`;
    if (!isRecord(segment)) {
      push(errors, base, 'must be an object');
      return;
    }
    const segmentId = validateId(segment.segment_id, `${base}.segment_id`, errors, 'segment id');
    if (segmentId !== undefined) {
      if (seenSegmentIds.has(segmentId)) push(errors, `${base}.segment_id`, 'must be unique');
      seenSegmentIds.add(segmentId);
    }
    const outcomeId = stringAt(segment, 'outcome_id');
    if (outcomeId === undefined || !outcomeIds.has(outcomeId)) {
      push(errors, `${base}.outcome_id`, 'must reference an outcome id');
    }
    const bitmapAssetId = stringAt(segment, 'bitmap_asset_id');
    if (bitmapAssetId !== undefined && !bitmapAssetIds.has(bitmapAssetId)) {
      push(errors, `${base}.bitmap_asset_id`, 'must reference bitmap_assets.asset_id');
    }
    const localizedLabel = segment.localized_label === undefined ? undefined : validateLocalizedCopy(segment.localized_label, `${base}.localized_label`, errors);
    if (segmentId !== undefined && outcomeId !== undefined && outcomeIds.has(outcomeId)) {
      const normalized: VisualWheelMapping['segments'][number] = { segment_id: segmentId, outcome_id: outcomeId };
      if (bitmapAssetId !== undefined && bitmapAssetIds.has(bitmapAssetId)) normalized.bitmap_asset_id = bitmapAssetId;
      if (localizedLabel !== undefined) normalized.localized_label = localizedLabel;
      segments.push(normalized);
    }
  });
  return segments.length > 0 ? { segments } : undefined;
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

  const quiz = validateQuiz(input.quiz, errors);
  const bitmapAssets = validateBitmapAssets(input.bitmap_assets, files, errors);
  const bitmapAssetIds = new Set((bitmapAssets ?? []).map((asset) => asset.asset_id));
  const ticketTemplates = validateTicketTemplates(input.ticket_templates, files, bitmapAssetIds, errors);
  const ticketTemplateIds = new Set((ticketTemplates ?? []).map((template) => template.template_id));
  const outcomeStrategy = validateOutcomeStrategy(input.outcome_strategy, ticketTemplateIds, bitmapAssetIds, errors);
  const outcomeIds = new Set<string>();
  for (const outcome of outcomeStrategy?.outcomes ?? []) outcomeIds.add(outcome.outcome_id);
  for (const prize of outcomeStrategy?.prizes ?? []) outcomeIds.add(prize.prize_id);
  const visualWheel = validateVisualWheel(input.visual_wheel, outcomeIds, bitmapAssetIds, errors);

  let legal: PackageManifest['legal'];
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

  if (campaignShortCode !== undefined) manifest.campaign_short_code = campaignShortCode;
  if (ticketTemplate !== undefined) manifest.ticket_template = ticketTemplate;
  if (quiz !== undefined) manifest.quiz = quiz;
  if (bitmapAssets !== undefined) manifest.bitmap_assets = bitmapAssets;
  if (ticketTemplates !== undefined) manifest.ticket_templates = ticketTemplates;
  if (outcomeStrategy !== undefined) manifest.outcome_strategy = outcomeStrategy;
  if (visualWheel !== undefined) manifest.visual_wheel = visualWheel;
  if (legal !== undefined && (legal.terms_path !== undefined || legal.privacy_path !== undefined)) manifest.legal = legal;
  if (packageSizeLimit !== undefined) manifest.package_size_limit_bytes = packageSizeLimit;

  return { ok: true, manifest, errors: [] };
}
