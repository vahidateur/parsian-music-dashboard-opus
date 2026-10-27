import type { ApiError } from "@/api/errors";
import { unavailableCapabilityDescription } from "@/targets/targetCopy";

/**
 * How a failed read should be presented. The classes are different facts and
 * must not share one "server not connected" sentence:
 *
 *   unavailable  the backend capability does not exist (DOMAIN_UNAVAILABLE);
 *                retrying cannot help.
 *   policy       the endpoint exists and refused on purpose (403: the
 *                OWNER_DECISION_REQUIRED_PB* policy blocks, or ordinary
 *                authorization); retrying cannot help, and the server IS
 *                connected.
 *   failure      network / 5xx / anything unexpected; retry stays.
 *
 * Empty data is not an error and never reaches this module.
 */
export type ErrorClass = "unavailable" | "policy" | "failure";

const DOMAIN_UNAVAILABLE_CODE = "DOMAIN_UNAVAILABLE";

export function classifyError(error: ApiError | null | undefined): ErrorClass {
  if (!error) return "failure";
  if (error.code === DOMAIN_UNAVAILABLE_CODE) return "unavailable";
  if (error.kind === "authorization") return "policy";
  return "failure";
}

/**
 * For a read that only decorates a page (a room name next to a class): the
 * page keeps working when the capability is unavailable or policy-blocked —
 * the missing names render as "no data" — and stops only for a real failure.
 */
export function blockingFailure(error: ApiError | null | undefined): ApiError | null {
  return error && classifyError(error) === "failure" ? error : null;
}

export const UNAVAILABLE_TITLE = "این بخش در این نسخه در دسترس نیست";
export const UNAVAILABLE_DESCRIPTION = unavailableCapabilityDescription;
export const POLICY_TITLE = "این درخواست مجاز نیست";