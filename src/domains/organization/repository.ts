import type { OrganizationSettings, UpdateOrganizationInput } from "./types";

/**
 * One record, two verbs — the same contract branding has.
 *
 * There is no list and no delete: an academy has exactly one set of rules, and
 * "removing" a rule means writing the default back, which `update` already does.
 */
export interface OrganizationRepository {
  get(signal?: AbortSignal): Promise<OrganizationSettings>;
  update(input: UpdateOrganizationInput, signal?: AbortSignal): Promise<OrganizationSettings>;
}
