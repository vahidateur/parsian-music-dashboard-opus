/**
 * Target seam — environment affordances (CLIENT composition target).
 *
 * The client build talks to a real API and contains no local dataset: there is
 * no demo environment to ask about, so the answer is a constant. Importing the
 * real lifecycle here would pull `demoStore` and the seed payload into the
 * client bundle, which is exactly what this seam exists to prevent.
 *
 * NOTE the hook shape: callers use this behind the same hook contract as the
 * demo target; it calls no hooks itself, which is valid.
 */

export function useIsDemoEnvironment(): boolean {
  return false;
}

/** Demo labelling has no place in the client build — render nothing. */
export function DemoNote(_props: { text?: string; className?: string }): null {
  return null;
}
