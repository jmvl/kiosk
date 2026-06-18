export type {
  BridgeCapability,
  CampaignBitmapAsset,
  CampaignOutcome,
  CampaignOutcomeType,
  CampaignQuiz,
  CampaignQuizChoice,
  CampaignTicketTemplate,
  LocalizedCopy,
  PackageManifest,
  PackageManifestFile,
  PackageOrientation,
  RequiredCampaignLocale,
  VisualWheelMapping,
  VisualWheelSegment,
} from './manifest.js';
export type { PackageManifestValidationResult, ValidationIssue } from './validate.js';

export {
  packageManifestRequiredFields,
  packageManifestSchemaVersion,
  requiredCampaignLocales,
} from './manifest.js';
export { validatePackageManifest } from './validate.js';
