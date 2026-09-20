/**
 * Typert Remote contribution for the `memoryStore` namespace.
 *
 * Mirror of the artifact `@deepseek-ai/dsh-typert-generator` emits for a Host
 * Remote owner: the browser half mounts it with `ctx.remote.$mount`, which
 * installs a `remote.memoryStore` service exposing the status, index read, and
 * index write. The codecs are permissive (`parse` passes any value through)
 * because the Host gateway re-derives its own descriptor from the service
 * method signature and validates there; the Client only needs a strict-shaped
 * codec so `$mount` accepts the contribution.
 *
 * @module @zhang-guo-wen/dsh-memory/typert
 */

import type {
  InvocationDescriptor,
  TypertCodec,
  TypertRemoteContribution,
  TypertSchema,
} from '@deepseek-ai/dsh-typert-protocol'

/** Wire namespace and Cordis service key of the memory-store owner. */
export const REMOTE_NAMESPACE = 'memoryStore'

/** Permissive strict codec: accepts any value, returns it unchanged. */
const passthrough: TypertSchema<unknown> = { parse: value => value }

/**
 * One strict codec over {@link passthrough}.
 *
 * Both schema seats carry the same parse contract: a Host whose Typert registry
 * materializes generated schemas requires the `create()` factory and calls it
 * when a boundary first uses the codec, while an older one calls `schema.parse`.
 * The published `@deepseek-ai/dsh-typert-protocol` release this package
 * dev-depends on declares `schema` alone, so the literal cannot satisfy those
 * types while carrying `create`; drop the assertion once a published protocol
 * version declares `create`.
 * @param typeSymbol - generated-style type symbol naming this codec.
 * @returns the strict codec handed to `ctx.remote.$mount`.
 */
function codec(typeSymbol: string): TypertCodec {
  return {
    mode: 'strict' as const,
    typeSymbol,
    schema: passthrough,
    create: () => passthrough,
  } as TypertCodec
}

function descriptor(method: string): InvocationDescriptor {
  const endpoint = `${REMOTE_NAMESPACE}/${method}`
  const owner = `@zhang-guo-wen/dsh-memory#${endpoint}`
  return {
    id: owner,
    service: REMOTE_NAMESPACE,
    namespace: REMOTE_NAMESPACE,
    method,
    invocation: { kind: 'direct' },
    parameters: [
      {
        name: 'request',
        wire: 'request',
        source: 'json',
        codec: codec(`${owner}:request`),
      },
    ],
    result: codec(`${owner}:result`),
  }
}

/** Contribution mounted by the browser half to reach the memory store. */
export const TYPERT_REMOTE: TypertRemoteContribution = {
  package: '@zhang-guo-wen/dsh-memory',
  descriptors: [
    descriptor('targets'),
    descriptor('status'),
    descriptor('readIndex'),
    descriptor('writeIndex'),
  ],
}
