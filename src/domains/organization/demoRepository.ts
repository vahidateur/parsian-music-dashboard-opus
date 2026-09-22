/**
 * Demo organization repository — the academy's rules, from the one dataset.
 *
 * Validation happens here rather than in the panel: a rule that reaches the
 * dataset has to be a rule the rest of the product can rely on, because the
 * conflict engine, the make-up prefill and the class form all read these values
 * back. A panel-side check alone would let a corrupt backup or an import write a
 * `defaultSessionMinutes` of `-30` and every consumer would have to defend
 * itself.
 */
import { validationError } from "@/domains/shared/demoCollection";
import { demoStore, type DemoStore } from "@/services/demoStore";
import type { OrganizationRepository } from "./repository";
import { validateOrganizationInput, withRuleDefaults, type OrganizationSettings, type UpdateOrganizationInput } from "./types";

export class DemoOrganizationRepository implements OrganizationRepository {
  constructor(private readonly store: DemoStore = demoStore) {}

  async get(): Promise<OrganizationSettings> {
    // A dataset written before session rules existed still resolves: absent
    // fields mean "the shipped default", never "no rule at all".
    return withRuleDefaults(this.store.organization.get());
  }

  async update(input: UpdateOrganizationInput): Promise<OrganizationSettings> {
    const errors = validateOrganizationInput(input);

    /*
      The window is validated as a pair, so a patch that changes only one side is
      checked against the stored other side — otherwise "start 22:00" would pass
      on its own and leave the academy with a window that closes before it opens.
    */
    if (input.workingDayStart !== undefined || input.workingDayEnd !== undefined) {
      const current = this.store.organization.get();
      const start = input.workingDayStart ?? current.workingDayStart;
      const end = input.workingDayEnd ?? current.workingDayEnd;
      const pairErrors = validateOrganizationInput({ workingDayStart: start, workingDayEnd: end });
      for (const key of ["workingDayStart", "workingDayEnd"] as const) {
        if (pairErrors[key] && !errors[key]) errors[key] = pairErrors[key];
      }
    }

    if (Object.keys(errors).length > 0) {
      throw validationError("ORGANIZATION_INVALID", "قواعد آموزشگاه معتبر نیست.", errors);
    }

    return withRuleDefaults(this.store.organization.update(input));
  }
}
