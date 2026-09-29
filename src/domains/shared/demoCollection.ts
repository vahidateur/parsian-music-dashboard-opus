/**
 * Compatibility re-export.
 *
 * The canonical module is `repositoryPlumbing.ts` (W3). Import paths that still
 * say `demoCollection` resolve here so this wave does not rewrite every
 * repository — those files are W4's. The two modules are not two implementations.
 */
export {
  DEFAULT_PER_PAGE,
  paginate,
  notFound,
  conflict,
  validationError,
  forbidden,
  matchesQuery,
  sortRows,
} from "./repositoryPlumbing";
export type { PageRequest } from "./repositoryPlumbing";
