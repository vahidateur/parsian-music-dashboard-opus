/**
 * REST organization repository.
 *
 * BACKEND REQUIRED — `GET /organization` and `PATCH /organization`.
 *
 * The registry does not select this implementation yet, exactly as it does not
 * for branding: there is no endpoint to talk to, and a panel that reads rules
 * from a 404 would show an academy its own configuration as broken. The contract
 * is written down here so the server has something to be built against, and so
 * the day it exists the registry changes one line.
 *
 * Rules are organization-scoped authorization-adjacent configuration in
 * production (§21): reading them requires `settings.read`, writing them
 * `settings.write`, and every value is validated server-side because the client's
 * validation is a convenience, not a control.
 */
import type { ApiClient } from "@/api/client";
import type { OrganizationRepository } from "./repository";
import { validateOrganizationInput, withRuleDefaults, type OrganizationSettings, type UpdateOrganizationInput } from "./types";
import { ApiError } from "@/api/errors";

export class ApiOrganizationRepository implements OrganizationRepository {
  constructor(private readonly client: ApiClient) {}

  async get(signal?: AbortSignal): Promise<OrganizationSettings> {
    const settings = await this.client.get<OrganizationSettings>("organization", { signal });
    return withRuleDefaults(settings);
  }

  async update(input: UpdateOrganizationInput, signal?: AbortSignal): Promise<OrganizationSettings> {
    const errors = validateOrganizationInput(input);
    if (Object.keys(errors).length > 0) {
      throw new ApiError({
        kind: "validation",
        code: "ORGANIZATION_INVALID",
        message: "قواعد آموزشگاه معتبر نیست.",
        fields: errors,
      });
    }
    const settings = await this.client.patch<OrganizationSettings>("organization", input, { signal });
    return withRuleDefaults(settings);
  }
}
