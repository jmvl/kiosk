import { type Config } from 'vitest/config';

export default {
  test: {
    include: ['**/*.hardware.test.ts'],
    environment: 'node',
  },
} satisfies Config;
