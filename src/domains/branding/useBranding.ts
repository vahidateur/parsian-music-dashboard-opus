/**
 * Branding hook + live theme application.
 *
 * Branding is organization data, so it is read through the repository and
 * refreshes with the global data version like any other domain value.
 *
 * Applying it sets a handful of CSS custom properties on `<html>`. Values are
 * validated by the repository before they are stored, so nothing unvalidated
 * reaches the style layer (§24).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiErrorFromThrown, type ApiError } from "@/api/errors";
import { getBrandingRepository, getOrganizationRepository } from "@/domains/registry";
import type { OrganizationSettings } from "@/domains/organization/types";
import { useDataVersion } from "@/domains/shared/dataVersion";
import { DEFAULT_BRANDING, isHexColor, isPersianFont, type BrandingSettings } from "./types";

export interface BrandingState {
  branding: BrandingSettings;
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
  /**
   * `false` when the branding capability has no server and only the academy's
   * name and tagline (the organization record) are real. Colours, font and
   * logo are then the product defaults, not server data, and cannot be saved.
   */
  visualsAvailable: boolean;
}

/** One read for every concurrent consumer (sidebar, top bar, hero, panel). */
let organizationRead: Promise<OrganizationSettings> | null = null;
function readOrganizationOnce(): Promise<OrganizationSettings> {
  if (organizationRead === null) {
    organizationRead = getOrganizationRepository()
      .get()
      .finally(() => {
        organizationRead = null;
      });
  }
  return organizationRead;
}

/** The identity the organization record states, over the product's own visual defaults. */
export function identityFromOrganization(org: OrganizationSettings): BrandingSettings {
  return { ...DEFAULT_BRANDING, academyName: org.name, tagline: org.tagline, updatedAt: org.updatedAt };
}

export function useBranding(): BrandingState {
  const dataVersion = useDataVersion();
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [nonce, setNonce] = useState(0);
  const [visualsAvailable, setVisualsAvailable] = useState(true);
  const latest = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const ticket = ++latest.current;
    setLoading(true);
    getBrandingRepository()
      .get(controller.signal)
      .then((result) => {
        if (ticket !== latest.current) return;
        setBranding(result);
        setVisualsAvailable(true);
        setError(null);
      })
      .catch(async (cause: unknown) => {
        const normalized = apiErrorFromThrown(cause);
        if (ticket !== latest.current || normalized.kind === "cancelled") return;
        if (normalized.code === "DOMAIN_UNAVAILABLE") {
          // No branding server: the academy's name and tagline still exist, in the organization record.
          try {
            const org = await readOrganizationOnce();
            if (ticket !== latest.current) return;
            setBranding(identityFromOrganization(org));
            setVisualsAvailable(false);
            setError(null);
            return;
          } catch (orgCause) {
            if (ticket !== latest.current) return;
            const orgError = apiErrorFromThrown(orgCause);
            if (orgError.kind === "cancelled") return;
            // A real organization failure is the one worth reporting; otherwise keep the unavailable state.
            setError(orgError.code === "DOMAIN_UNAVAILABLE" ? normalized : orgError);
            return;
          }
        }
        setError(normalized);
      })
      .finally(() => {
        if (ticket === latest.current) setLoading(false);
      });
    return () => controller.abort();
  }, [nonce, dataVersion]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return useMemo(
    () => ({ branding, loading, error, reload, visualsAvailable }),
    [branding, loading, error, reload, visualsAvailable],
  );
}

/**
 * Writes branding into CSS custom properties.
 *
 * Defensive re-validation: this function is the last step before values touch
 * the DOM, and it must stay safe even if called with data from a restored
 * backup that predates a validation rule.
 */
export function applyBranding(branding: BrandingSettings, root: HTMLElement): void {
  const setColor = (property: string, value: string) => {
    if (isHexColor(value)) root.style.setProperty(property, value);
  };
  setColor("--brand-primary", branding.primaryColor);
  setColor("--brand-accent", branding.accentColor);
  setColor("--brand-text", branding.textColor);

  if (isPersianFont(branding.persianFont)) {
    root.style.setProperty("--brand-font-fa", branding.persianFont);
  }
}

/** Applies branding to `document.documentElement` whenever it changes. */
export function useApplyBranding(branding: BrandingSettings): void {
  useEffect(() => {
    if (typeof document === "undefined") return;
    applyBranding(branding, document.documentElement);
  }, [branding]);
}
