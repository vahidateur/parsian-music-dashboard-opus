/**
 * Settings → academy identity.
 *
 * Replaces the previous `defaultValue` form that tracked a "dirty" flag and
 * persisted nothing. Every field here writes through `BrandingRepository`, and
 * the success toast only appears after the write resolves (§37).
 */
import { useEffect, useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button, Surface } from "@/components/ds/primitives";
import { Field, Panel, inputCls } from "@/components/ds/patterns";
import { ErrorState, LoadingState } from "@/components/ds/states";
import { useApp } from "@/context/AppContext";
import { getBrandingRepository } from "@/domains/registry";
import { apiErrorFromThrown, type ApiError } from "@/api/errors";
import { useBranding } from "./useBranding";
import { PERSIAN_FONTS, type BrandingSettings } from "./types";
import { cn } from "@/utils/cn";

interface Draft {
  academyName: string;
  tagline: string;
  primaryColor: string;
  accentColor: string;
  textColor: string;
  persianFont: string;
}

function toDraft(branding: BrandingSettings): Draft {
  return {
    academyName: branding.academyName,
    tagline: branding.tagline,
    primaryColor: branding.primaryColor,
    accentColor: branding.accentColor,
    textColor: branding.textColor,
    persianFont: branding.persianFont,
  };
}

/** Colour input paired with a text field, so a value can be typed or picked. */
function ColorField({
  label,
  value,
  error,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  disabled: boolean;
  onChange: (next: string) => void;
}) {
  return (
    <Field label={label} error={error}>
      {(control) => (
        <div className="flex items-center gap-2">
          <input
            {...control}
            className={cn(inputCls, "flex-1 font-mono")}
            dir="ltr"
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
          <input
            type="color"
            aria-label={`${label} — انتخاب از پالت`}
            value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="size-9 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-transparent p-0.5"
          />
        </div>
      )}
    </Field>
  );
}

export function BrandingPanel() {
  const { notify } = useApp();
  const { branding, loading, error, reload } = useBranding();
  const [draft, setDraft] = useState<Draft>(() => toDraft(branding));
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Adopt loaded/refreshed values, but never stomp on an in-progress edit.
  useEffect(() => {
    if (!saving) setDraft(toDraft(branding));
    // `branding.updatedAt` changes on every persisted save.
  }, [branding, saving]);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(toDraft(branding)),
    [draft, branding],
  );

  const set = <K extends keyof Draft>(key: K) => (value: Draft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setFields((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setFields({});
    try {
      const saved = await getBrandingRepository().update(draft);
      setSavedAt(saved.updatedAt);
      notify({ tone: "success", title: "هویت آموزشگاه ذخیره شد", detail: "تغییرات در دادهٔ دمو ثبت شد." });
    } catch (cause) {
      const apiError: ApiError = apiErrorFromThrown(cause);
      setFields(apiError.fields ?? {});
      notify({ tone: "danger", title: "ذخیره‌سازی ناموفق بود", detail: apiError.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState className="py-24" label="در حال بارگذاری هویت آموزشگاه…" />;
  if (error)
    return <ErrorState className="py-24" title="بارگذاری ناموفق بود" description={error.message} onRetry={reload} />;

  return (
    <>
      <Panel title="هویت آموزشگاه" kicker="نام و شعاری که در سراسر سامانه دیده می‌شود">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="نام آموزشگاه" error={fields.academyName?.[0]} required className="sm:col-span-2">
            {(control) => (
              <input
                {...control}
                className={inputCls}
                value={draft.academyName}
                disabled={saving}
                onChange={(e) => set("academyName")(e.target.value)}
              />
            )}
          </Field>
          <Field label="شعار / معرفی کوتاه" error={fields.tagline?.[0]} className="sm:col-span-2">
            {(control) => (
              <textarea
                {...control}
                rows={2}
                className={cn(inputCls, "h-auto py-2.5 leading-relaxed")}
                value={draft.tagline}
                disabled={saving}
                onChange={(e) => set("tagline")(e.target.value)}
              />
            )}
          </Field>
        </div>
      </Panel>

      <Panel title="رنگ و تایپوگرافی" kicker="رنگ‌های برند و فونت فارسی سامانه">
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField
            label="رنگ اصلی"
            value={draft.primaryColor}
            error={fields.primaryColor?.[0]}
            disabled={saving}
            onChange={set("primaryColor")}
          />
          <ColorField
            label="رنگ مکمل"
            value={draft.accentColor}
            error={fields.accentColor?.[0]}
            disabled={saving}
            onChange={set("accentColor")}
          />
          <ColorField
            label="رنگ متن"
            value={draft.textColor}
            error={fields.textColor?.[0]}
            disabled={saving}
            onChange={set("textColor")}
          />
          <Field label="فونت فارسی" error={fields.persianFont?.[0]}>
            {(control) => (
              <select
                {...control}
                className={inputCls}
                value={draft.persianFont}
                disabled={saving}
                onChange={(e) => set("persianFont")(e.target.value)}
              >
                {PERSIAN_FONTS.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] leading-relaxed text-ink-400">
            {savedAt ? "آخرین ذخیره‌سازی انجام شد." : "تغییرات پس از ذخیره در همهٔ بخش‌ها اعمال می‌شود."}
          </p>
          <Button variant="primary" size="sm" onClick={() => void save()} disabled={!dirty || saving}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            {saving ? "در حال ذخیره…" : "ذخیرهٔ تغییرات"}
          </Button>
        </div>
      </Panel>

      <Surface className="border-warn-500/20 bg-warn-500/[0.05] p-4">
        <p className="text-[11.5px] leading-relaxed text-ink-200">
          بارگذاری لوگو و favicon به فضای ذخیره‌سازی فایل نیاز دارد. در نسخهٔ دمو فایل‌ها فقط در همین مرورگر نگهداری
          می‌شوند و در پشتیبان قرار نمی‌گیرند؛ استقرار عملیاتی به object storage سمت سرور نیاز دارد.
        </p>
      </Surface>
    </>
  );
}
