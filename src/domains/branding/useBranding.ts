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
import { getBrandingRepository } from "@/domains/registry";
import { useDataVersion } from "@/domains/shared/dataVersion";
import { DEFAULT_BRANDING, isHexColor, isPersianFont, type BrandingSettings } from "./types";

export interface BrandingState {
  branding: BrandingSettings;
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
}

export function useBranding(): BrandingState {
  const dataVersion = useDataVersion();
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [nonce, setNonce] = useState(0);
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
        setError(null);
      })
      .catch((cause: unknown) => {
        const normalized = apiErrorFromThrown(cause);
        if (ticket !== latest.current || normalized.kind === "cancelled") return;
        setError(normalized);
      })
      .finally(() => {
        if (ticket === latest.current) setLoading(false);
      });
    return () => controller.abort();
  }, [nonce, dataVersion]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return useMemo(() => ({ branding, loading, error, reload }), [branding, loading, error, reload]);
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
