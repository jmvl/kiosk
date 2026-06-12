export const skeletonPackage = {
  name: '@retail-kiosk/shared-types',
  kind: 'package',
} as const;

export type SkeletonPackage = typeof skeletonPackage;
