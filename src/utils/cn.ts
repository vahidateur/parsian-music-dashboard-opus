import { cn as mergeClassNames } from "./mergeClassNames";

/**
 * Class-name helper. Kept as a named re-export so every existing `cn(...)` call site
 * (60 files) is unchanged; the conflict resolution lives in `mergeClassNames.ts`.
 */
export const cn = mergeClassNames;
