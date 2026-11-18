import type { ApiError } from "@/api/errors";
import { cn } from "@/utils/cn";

/**
 * The shell's academy identity while it is loading or after its read failed.
 *
 * `useBranding` starts from `DEFAULT_BRANDING`; that default is a product
 * placeholder, not the academy's own name. Every surface that renders the
 * identity uses this notice instead of the placeholder until a read has
 * actually answered. The intentional `DOMAIN_UNAVAILABLE` path is different:
 * it resolves the name/tagline from the organization record and reports no
 * error, so it renders the normal identity.
 */
export function BrandingIdentityNotice({
  loading,
  error,
  onRetry,
  className,
}: {
  loading: boolean;
  error: ApiError | null;
  onRetry: () => void;
  className?: string;
}) {
  if (loading) {
    return (
      <span className={cn("text-[11px] leading-relaxed text-ink-400", className)} role="status">
        در حال خواندن هویت آموزشگاه…
      </span>
    );
  }
  if (!error) return null;
  return (
    <span className={cn("text-[11px] leading-relaxed text-warn-300", className)} role="alert">
      <span>هویت آموزشگاه خوانده نشد</span>{" "}
      <button type="button" className="underline underline-offset-2" onClick={onRetry}>
        تلاش دوباره
      </button>
    </span>
  );
}
