/**
 * Self-contained spec runner: the specs that need no checkout-owned package.
 *
 * The suite runs on the Harness checkout's `vitest` binary because this package
 * does not install a test runner of its own:
 *
 *   node_modules/.bin/vitest run --root dsh-memory     # from the Harness checkout
 *
 * Harness packages resolve from this package's `node_modules`, so a spec may
 * import `@deepseek-ai/*` runtime values that this package declares. The
 * Loader composition spec mounts packages this package does not depend on
 * (the system-prompt registry and the checkout's own Loader), and the settings
 * controller spec loads `dsh-client-store`, whose Zustand engine this package
 * does not install, so both belong to `vitest.harness.config.ts`; see
 * tests/README.md.
 */
export default {
  test: {
    include: ['tests/**/*.spec.ts'],
    exclude: ['node_modules/**', 'tests/loader-composition.spec.ts', 'tests/settings-controller.spec.ts'],
    environment: 'node',
    pool: 'forks',
  },
}
