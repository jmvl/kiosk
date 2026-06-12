export const skeletonPackage = {
  name: '@retail-kiosk/kiosk-agent',
  kind: 'service',
} as const;

export type SkeletonPackage = typeof skeletonPackage;
