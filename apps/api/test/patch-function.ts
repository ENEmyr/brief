// Test-only shim for running Elysia's CloudflareAdapter under @cloudflare/vitest-pool-workers.
//
// In production workerd allows dynamic code generation while the Worker's global scope is
// being evaluated, so `createApp().compile()` works under `wrangler dev` and `wrangler deploy`.
// Under vitest-pool-workers every module is evaluated dynamically (inside a request), where
// workerd forbids code generation. The pool compensates by wrapping globalThis.Function in a
// Proxy whose `construct` trap delegates to the sanctioned UnsafeEval binding - but that trap
// only fires for `new Function(...)`. Elysia's composeErrorHandler invokes `Function(...)`
// without `new`, so it bypasses the trap and hits the runtime restriction.
//
// This shim adds an `apply` trap that forwards plain calls to Reflect.construct, which routes
// through the pool's construct trap and therefore through UnsafeEval. `new Function` and plain
// `Function` are spec-equivalent, so behavior is unchanged.
const PATCHED = Symbol.for('brief.test.functionApplyPatch')

const globals = globalThis as { [PATCHED]?: boolean }

if (!globals[PATCHED]) {
  globals[PATCHED] = true
  globalThis.Function = new Proxy(globalThis.Function, {
    apply(target, _thisArg, args) {
      return Reflect.construct(target, args)
    },
  })
}
