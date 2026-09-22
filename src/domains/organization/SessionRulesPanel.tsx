/**
 * Session rules — Settings → عملیات آموزشگاه → قواعد جلسه.
 *
 * This panel used to hold four disabled inputs and a notice saying they were not
 * connected to anything. Every field here now has a consumer named beside it,
 * because a rule nobody reads is not a rule:
 *
 *   مدت پیش‌فرض جلسه        pre-fills a new class's duration and the length a
 *                           make-up session is proposed at.
 *   فاصلهٔ بین جلسات        below this turnaround, the conflict engine warns
 *                           about the same teacher or room being reused too fast.
 *   مهلت لغو بدون جریمه     the cancellation dialog states whether this
 *                           cancellation is still inside the window.
 *   سقف جلسات جبرانی        the make-up ledger counts against it per student.
 *
 * Editing writes through the repository, which validates and persists; the store
 * bump re-reads every surface that quotes a rule, so the schedule and the panel
 * cannot disagree about what the academy decided.
 *
 * The fields show the STORED value until somebody types, rather than a copy of it
 * held in state and filled in by an effect. A copy has a frame where it is empty —
 * which reads as "this academy has no rules" — and it can also drift when the
 * record changes from elsewhere. The typed overlay is the only local state.
 */
import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useCan } from "@/domains/auth/AuthContext";
import { useIsDemoEnvironment } from "@/domains/demo/useDataLifecycle";
import { Button, StatusBadge } from "@/components/ds/primitives";
import { Field, Panel, inputCls } from "@/components/ds/patterns";
import { LoadingState, ErrorState } from "@/components/ds/states";
import { faNum, parseTypedNumber } from "@/lib/format";
import { cn } from "@/utils/cn";
import { useOrganization } from "./useOrganization";
import {
  DEFAULT_ORGANIZATION_SETTINGS,
  RULE_BOUNDS,
  validateOrganizationInput,
  type OrganizationSettings,
  type UpdateOrganizationInput,
} from "./types";

type RuleKey = "defaultSessionMinutes" | "sessionGapMinutes" | "cancellationGraceHours" | "maxMakeupsPerTerm";

interface RuleField {
  key: RuleKey;
  label: string;
  unit: string;
  /** What actually reads this value — stated on the surface, not in a document. */
  consumer: string;
}

const RULE_FIELDS: readonly RuleField[] = [
  {
    key: "defaultSessionMinutes",
    label: "مدت پیش‌فرض جلسه",
    unit: "دقیقه",
    consumer: "پیش‌فرض مدت کلاس جدید و طول پیشنهادی جلسهٔ جبرانی",
  },
  {
    key: "sessionGapMinutes",
    label: "فاصلهٔ بین جلسات",
    unit: "دقیقه",
    consumer: "کمتر از این فاصله، هشدار «فرصت کم برای جابجایی» ثبت می‌شود",
  },
  {
    key: "cancellationGraceHours",
    label: "مهلت لغو بدون جریمه",
    unit: "ساعت",
    consumer: "در گفتگوی لغو جلسه گفته می‌شود که لغو داخل مهلت است یا نه",
  },
  {
    key: "maxMakeupsPerTerm",
    label: "سقف جلسات جبرانی هر هنرجو",
    unit: "جلسه",
    consumer: "هنگام ثبت جبرانی اعمال می‌شود؛ صفر یعنی آموزشگاه جبرانی ثبت نمی‌کند",
  },
];

export function SessionRulesPanel() {
  const { notify } = useApp();
  /* `useCan`, not `useAuth().can`: a settings panel is rendered by surfaces that
     hold no session, and the gate helper answers "allowed" there instead of
     throwing the panel away. */
  const mayWrite = useCan("settings.write");
  const demoEnvironment = useIsDemoEnvironment();
  const organization = useOrganization();
  const settings = organization.settings;

  /** What has been typed and not yet saved, per field. Empty = show the record. */
  const [edits, setEdits] = useState<Partial<Record<RuleKey, string>>>({});
  const [localErrors, setLocalErrors] = useState<Partial<Record<RuleKey, string>>>({});

  // A write from anywhere — this panel, another tab, a restored backup — drops the
  // local overlay, so the fields never sit on top of a value that moved.
  useEffect(() => {
    setEdits({});
    setLocalErrors({});
  }, [settings.updatedAt]);

  const valueOf = (key: RuleKey) => edits[key] ?? String(settings[key]);
  const numberOf = (key: RuleKey) => parseTypedNumber(valueOf(key));

  const dirty = RULE_FIELDS.some((field) => edits[field.key] !== undefined && numberOf(field.key) !== settings[field.key]);

  const buildPatch = (): UpdateOrganizationInput | null => {
    const patch: UpdateOrganizationInput = {};
    const errors: Partial<Record<RuleKey, string>> = {};
    for (const field of RULE_FIELDS) {
      // Typed in either digit set — ۶۰ and 60 are the same rule.
      const value = numberOf(field.key);
      if (value === null) {
        errors[field.key] = "یک عدد وارد کنید.";
        continue;
      }
      patch[field.key] = value;
    }
    const fieldErrors = validateOrganizationInput(patch) as Partial<Record<RuleKey, string[]>>;
    for (const field of RULE_FIELDS) {
      const message = fieldErrors[field.key]?.[0];
      if (message && !errors[field.key]) errors[field.key] = message;
    }
    setLocalErrors(errors);
    return RULE_FIELDS.some((field) => errors[field.key]) ? null : patch;
  };

  const save = async () => {
    const patch = buildPatch();
    if (!patch) {
      notify({ tone: "warning", title: "قواعد ذخیره نشد", detail: "مقادیر نامعتبر است؛ پیام هر فیلد را ببینید." });
      return;
    }
    const error = await organization.update(patch);
    if (error) {
      notify({ tone: "danger", title: "ذخیرهٔ قواعد ناموفق بود", detail: error.message });
      return;
    }
    notify({
      tone: "success",
      title: "قواعد جلسه ذخیره شد",
      detail: "از این لحظه جلسات جدید، هشدارهای زمان‌بندی و جبرانی‌ها بر همین مقادیر رفتار می‌کنند.",
    });
  };

  const resetDefaults = async () => {
    const error = await organization.update({
      defaultSessionMinutes: DEFAULT_ORGANIZATION_SETTINGS.defaultSessionMinutes,
      sessionGapMinutes: DEFAULT_ORGANIZATION_SETTINGS.sessionGapMinutes,
      cancellationGraceHours: DEFAULT_ORGANIZATION_SETTINGS.cancellationGraceHours,
      maxMakeupsPerTerm: DEFAULT_ORGANIZATION_SETTINGS.maxMakeupsPerTerm,
    });
    notify(
      error
        ? { tone: "danger", title: "بازنشانی ناموفق بود", detail: error.message }
        : { tone: "info", title: "قواعد به پیش‌فرض بازگشت" },
    );
  };

  if (organization.loading) {
    return (
      <Panel title="قواعد جلسه">
        <LoadingState label="در حال بارگذاری قواعد جلسه…" />
      </Panel>
    );
  }

  return (
    <Panel
      title="قواعد جلسه"
      kicker="مقادیری که واقعاً اعمال می‌شوند — مصرف‌کنندهٔ هرکدام زیر همان فیلد نوشته شده"
      aside={dirty ? <StatusBadge tone="warn" label="ذخیره‌نشده" glyph={false} /> : undefined}
    >
      {organization.error && (
        <div className="mb-4">
          <ErrorState
            title="خواندن قواعد ناموفق بود"
            description={organization.error.message}
            onRetry={organization.reload}
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {RULE_FIELDS.map((field) => {
          const bounds = RULE_BOUNDS[field.key];
          const error = localErrors[field.key] ?? organization.error?.fields?.[field.key]?.[0];
          return (
            <Field
              key={field.key}
              label={field.label}
              hint={`${field.unit} · ${faNum(bounds.min)} تا ${faNum(bounds.max)}`}
              error={error}
            >
              {(control) => (
                <>
                  <input
                    {...control}
                    dir="ltr"
                    inputMode="numeric"
                    className={cn(inputCls, "nums text-left")}
                    value={valueOf(field.key)}
                    disabled={!mayWrite || organization.saving}
                    onChange={(event) => {
                      setEdits((prev) => ({ ...prev, [field.key]: event.target.value }));
                      setLocalErrors((prev) => ({ ...prev, [field.key]: undefined }));
                    }}
                  />
                  <span className="mt-1 block text-[10.5px] leading-relaxed text-ink-500">{field.consumer}</span>
                </>
              )}
            </Field>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-[11px] leading-relaxed text-ink-400">
          تغییر این مقادیر جلسات ثبت‌شدهٔ گذشته را جابجا نمی‌کند؛ از نخستین جلسهٔ بعدی اعمال می‌شود. سامانه هنوز
          «دورهٔ تحصیلی» به‌عنوان یک موجودیت ندارد، بنابراین سقف جبرانی روی همهٔ جبرانی‌های ثبت‌شدهٔ هر هنرجو شمارش
          می‌شود، نه بر اساس ترم.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" disabled={!mayWrite || organization.saving} onClick={() => void resetDefaults()}>
            <RotateCcw className="size-3.5" /> پیش‌فرض
          </Button>
          <Button variant="primary" disabled={!mayWrite || organization.saving || !dirty} onClick={() => void save()}>
            {organization.saving ? "در حال ذخیره…" : "ذخیرهٔ قواعد"}
          </Button>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
        {demoEnvironment
          ? "این قواعد بخشی از دادهٔ آموزشگاه است: در همین محیط ذخیره می‌شود، در پشتیبان‌ها می‌آید و هر بخشِ مصرف‌کننده همان نسخه را می‌خواند."
          : "ذخیرهٔ سراسری قواعد به سرور نیاز دارد؛ تا اتصال endpoint سازمان، این مقادیر روی دادهٔ همین دستگاه اعمال می‌شود."}
      </p>

      {!mayWrite && (
        <p className="mt-2 text-[11px] text-warn-400">
          برای تغییر قواعد به دسترسی «تنظیمات» نیاز دارید؛ مقادیر بالا برای شما فقط خواندنی است.
        </p>
      )}
    </Panel>
  );
}

/** Re-exported so a consumer can name the record type without a second import. */
export type { OrganizationSettings };
