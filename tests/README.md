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
| `loader-composition.spec.ts` | A real Loader composition: the row activates, the tool registers, the `memoryStore` Remote answers, and a disabled row contributes nothing |

## Self-contained subset

```sh
node_modules/.bin/vitest run --root dsh-memory
```

`vitest.config.ts` resolves `@deepseek-ai/*` from this package's own `node_modules` and takes only `tests/**/*.spec.ts`.
It runs `store.spec.ts`, `settings.spec.ts`, `instructions.spec.ts`, and `tool.spec.ts`; `loader-composition.spec.ts`
needs the checkout's Loader and registry packages, so it belongs to the full run.
