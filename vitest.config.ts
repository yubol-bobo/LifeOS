import { defineConfig } from 'vitest/config';

// dates are local-time; run in a zone with daylight saving to catch off-by-one-day bugs
(globalThis as { process?: { env: Record<string, string | undefined> } }).process!.env.TZ ??= 'America/New_York';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'jsdom',
    setupFiles: ['tests/unit/setup.ts'],
  },
});
