/**
 * Partial repository overrides for tests.
 *
 * A stub has to delegate everything it does not override, and the demo
 * repositories keep their verbs on the prototype — so `{ ...repository, verb }`
 * silently drops every other verb and produces a stub that throws
 * "not a function" for the reads the case never meant to touch. This Proxy
 * leaves the original object intact, swaps only the named verbs, and binds
 * delegated methods to it so `this` still points at the real repository.
 *
 * It is deliberately not a fixture factory: the point of every case using it is
 * that the writes and the untouched reads are the real ones.
 */
export type Stubs<R> = { [K in keyof R]?: R[K] };

export function withStubs<R extends object>(repository: R, stubs: Stubs<R>): R {
  return new Proxy(repository, {
    get(target, prop, receiver) {
      if (prop in stubs) return stubs[prop as keyof R];
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as R;
}
