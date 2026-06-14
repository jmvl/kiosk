export const skeletonPackage = {
  name: '@retail-kiosk/local-backend',
  kind: 'service',
} as const;

export type SkeletonPackage = typeof skeletonPackage;
