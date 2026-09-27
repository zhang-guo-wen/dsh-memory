# Specs for this plugin

This repository is a standalone package: its specs are not part of the Harness monorepo test gate, and the Harness
checkout beside it owns the `vitest` binary. Both commands below run **from that checkout**.

## Full suite (recommended)

```sh
node_modules/.bin/vitest run --root dsh-memory --config vitest.harness.config.ts
```

`vitest.harness.config.ts` resolves `@deepseek-ai/*` through the checkout's `tsconfig.base.json` paths, so the
composition spec boots the checkout's own Loader, system-prompt registry, and tool registry.

| Spec | Covers |
|---|---|
| `store.spec.ts` | `/memories` addressing, the six commands and their reply strings, index caps, directory listing, containment and byte caps |
| `settings.spec.ts` | `~` and `{project}` resolution, project naming, worktree resolution, the settings namespace and its composition fallback |
| `instructions.spec.ts` | The rendered protocol text, the message source, folding into the first step that carries a message, once-per-Session and resumed-Session behavior |
| `tool.spec.ts` | The registered tool's parameters and reply rendering, `runCommand` per verb, missing-field and refused-path answers |
| `loader-composition.spec.ts` | A real Loader composition: the row activates, the tool registers, the `memoryStore` Remote answers, a disabled row contributes nothing, and `enabled: false` withdraws the tool while the settings page still reports |
| `memory-section.spec.tsx` | The settings section rendered with a real dictionary: switch, directory field, browser panel, state rows, index editor, and the unavailable state |
| `settings-controller.spec.ts` | The section controller over the settings domain's configuration form: the fields it projects, one write per action, snapping back when the Host refuses, and the unavailable and read-only states |

## Self-contained subset

```sh
node_modules/.bin/vitest run --root dsh-memory
```

`vitest.config.ts` resolves `@deepseek-ai/*` from this package's own `node_modules` and takes only `tests/**/*.spec.ts`.
It runs `store.spec.ts`, `settings.spec.ts`, `instructions.spec.ts`, and `tool.spec.ts`; `loader-composition.spec.ts`
needs the checkout's Loader and registry packages, `memory-section.spec.tsx` needs React, and
`settings-controller.spec.ts` loads `dsh-client-store`, whose Zustand engine this package does not install, so all
three belong to the full run.
