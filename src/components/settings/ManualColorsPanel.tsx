/**
 * Manual colours — Settings → ظاهر → رنگ‌های دستی.
 *
 * The theme presets are named sets of stage colours; this panel lets somebody
 * type a colour instead of choosing one. Three slots are exposed — background,
 * surface and text — because those three are what the whole neutral ramp is
 * derived from, so typing one moves every panel, border and muted label with it
 * rather than repainting a single rectangle.
 *
 * The alpha form is accepted (`#9f9f9f9f`): a translucent panel is a legitimate
 * thing to want, and a validator that quietly rejects it teaches people that the
 * field does nothing.
 *
 * Scope, stated on the surface itself: these are *viewer* overrides for this
 * device. The academy's colours — the ones every visitor, parent and teacher
 * sees — live in the branding record under «پروفایل آموزشگاه».
 */
import { useEffect, useState } from "react";
import { Check, Eraser, Pipette } from "lucide-react";
import { useApp } from "@/context/AppContext";
import {
  PALETTE_SLOTS,
  isHexColorInput,
  normalizeHex,
  toPickerHex,
  type PaletteSlot,
} from "@/lib/theme";
import { Panel } from "@/components/ds/patterns";
import { cn } from "@/utils/cn";

/**
 * A value that is not a colour *yet*: `#1`, `#12`, `#abc` mid-keystroke. Shaping
 * a hex code is a sequence of edits, and flagging every step of it as a mistake
 * teaches people to ignore the field — so an in-progress value stays quiet until
 * the field loses focus, and anything that could never become a colour
 * (`قرمز`, `#gggggg`) is refused immediately.
 */
const HEX_IN_PROGRESS = /^#?[0-9a-fA-F]{0,8}$/;

export function ManualColorsPanel() {
  const { colors, setColor, clearColors, notify } = useApp();
  /*
    Each slot keeps what has been typed, separate from what has been applied:
    "#9f9" mid-keystroke is not yet a colour anyone wants painted across the
    product, but it must not be rejected as an error either. The value is applied
    the moment it parses, so the panel you are looking at *is* the preview.
    */
  const [drafts, setDrafts] = useState<Record<PaletteSlot, string>>({
    background: colors.background ?? "",
    surface: colors.surface ?? "",
    text: colors.text ?? "",
  });
  /** Whether a field has been left once with an unfinished value in it. */
  const [touched, setTouched] = useState<Record<PaletteSlot, boolean>>({
    background: false,
    surface: false,
    text: false,
  });

  // A reset from elsewhere (the appearance reset button) clears the fields too.
  useEffect(() => {
    setDrafts({
      background: colors.background ?? "",
      surface: colors.surface ?? "",
      text: colors.text ?? "",
    });
  }, [colors.background, colors.surface, colors.text]);

  const apply = (slot: PaletteSlot, raw: string) => {
    setDrafts((prev) => ({ ...prev, [slot]: raw }));
    const value = raw.trim();
    if (value === "") {
      setColor(slot, null);
      return;
    }
    if (isHexColorInput(value)) setColor(slot, normalizeHex(value));
  };

  /** Typed, not yet a complete colour, and not yet abandoned — the quiet state. */
  const inProgress = (slot: PaletteSlot) => {
    const value = drafts[slot].trim();
    return value !== "" && !isHexColorInput(value) && HEX_IN_PROGRESS.test(value) && !touched[slot];
  };

  const invalid = (slot: PaletteSlot) => {
    const value = drafts[slot].trim();
    if (value === "" || isHexColorInput(value)) return false;
    return touched[slot] || !HEX_IN_PROGRESS.test(value);
  };

  const typed = PALETTE_SLOTS.filter((slot) => colors[slot.key]).length;

  return (
    <Panel
      title="رنگ‌های دستی"
      kicker="کد رنگ را بنویسید یا از انتخابگر بردارید — تغییر بلافاصله روی همین صفحه اعمال می‌شود"
      aside={
        typed > 0 ? (
          <span className="inline-flex h-6 items-center rounded-full border border-gold-500/25 bg-gold-500/10 px-2 text-[11px] font-medium text-gold-200">
            {typed} رنگ دستی فعال
          </span>
        ) : undefined
      }
      action={typed > 0 ? "پاک کردن همه" : undefined}
      onAction={
        typed > 0
          ? () => {
              clearColors();
              notify({ tone: "info", title: "رنگ‌های دستی پاک شد", detail: "تم انتخابی دوباره تنها منبع رنگ است." });
            }
          : undefined
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {PALETTE_SLOTS.map((slot) => {
          const value = colors[slot.key];
          return (
            <div key={slot.key} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-medium text-ink-100">{slot.label}</span>
                {value && (
                  <button
                    type="button"
                    onClick={() => apply(slot.key, "")}
                    className="inline-flex items-center gap-1 text-[10.5px] text-ink-400 transition-colors hover:text-danger-400"
                    aria-label={`پاک کردن ${slot.label}`}
                  >
                    <Eraser className="size-3" strokeWidth={1.8} /> پاک کردن
                  </button>
                )}
              </div>
              <p className="mt-0.5 text-[10.5px] leading-relaxed text-ink-400">{slot.hint}</p>

              <div className="mt-2 flex items-center gap-2">
                <label className="relative flex size-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-white/[0.1]">
                  <span
                    className="absolute inset-0"
                    style={{
                      background: value
                        ? normalizeHex(value)
                        : "repeating-conic-gradient(#3a3733 0% 25%, #242220 0% 50%) 0 0 / 10px 10px",
                    }}
                    aria-hidden
                  />
                  <Pipette className="relative size-3.5 text-ink-50 mix-blend-difference" strokeWidth={1.8} aria-hidden />
                  <input
                    type="color"
                    value={toPickerHex(value)}
                    onChange={(event) => apply(slot.key, event.target.value)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label={`انتخابگر ${slot.label}`}
                  />
                </label>
                <input
                  dir="ltr"
                  spellCheck={false}
                  autoComplete="off"
                  value={drafts[slot.key]}
                  onChange={(event) => {
                    setTouched((prev) => ({ ...prev, [slot.key]: false }));
                    apply(slot.key, event.target.value);
                  }}
                  onBlur={(event) => {
                    setTouched((prev) => ({ ...prev, [slot.key]: true }));
                    const value = event.target.value.trim();
                    if (value !== "" && isHexColorInput(value)) apply(slot.key, normalizeHex(value));
                  }}
                  placeholder="#9f9f9f9f"
                  aria-label={slot.label}
                  aria-invalid={invalid(slot.key) || undefined}
                  className={cn(
                    "h-9 min-w-0 flex-1 rounded-lg border bg-ink-900 px-2.5 text-left text-[12px] nums text-ink-100 outline-none transition-colors",
                    invalid(slot.key)
                      ? "border-danger-500/50 focus:border-danger-400"
                      : "border-white/[0.08] focus:border-gold-500/45",
                  )}
                />
              </div>

              <div className="mt-2 min-h-[16px] text-[10.5px]">
                {invalid(slot.key) ? (
                  <span className="text-danger-400">
                    کد رنگ معتبر نیست — شکل درست: <span dir="ltr" className="nums">#rgb</span>،{" "}
                    <span dir="ltr" className="nums">#rrggbb</span> یا{" "}
                    <span dir="ltr" className="nums">#rrggbbaa</span>
                  </span>
                ) : inProgress(slot.key) ? (
                  <span className="text-ink-500">در حال نوشتن…</span>
                ) : value ? (
                  <span className="inline-flex items-center gap-1 text-ok-400">
                    <Check className="size-3" strokeWidth={2.2} />
                    <span dir="ltr" className="nums">
                      {value}
                    </span>{" "}
                    اعمال شد
                  </span>
                ) : (
                  <span className="text-ink-500">از تم انتخابی می‌آید</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
        این رنگ‌ها فقط روی دستگاه شما اعمال می‌شوند و بر تم انتخابی اولویت دارند؛ با پاک کردن مرورگر یا زدن «پاک کردن
        همه» از بین می‌روند. رنگ‌های سراسری آموزشگاه — نام، نشان و رنگ برند که همهٔ کاربران می‌بینند — در بخش «پروفایل
        آموزشگاه» ویرایش می‌شود.
      </p>
    </Panel>
  );
}
