import { useRef } from "react";
import { AlertTriangle, Download, Eraser, RotateCcw, Upload } from "lucide-react";
import { backupFileName } from "@/domains/demo";
import { DESTRUCTIVE_LABELS, useDemoData, type DestructiveAction } from "@/domains/demo/useDemoData";
import { DEMO_COLLECTIONS } from "@/domains/demo/types";
import { downloadTextFile } from "@/lib/download";
import { faNum } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/domains/auth/AuthContext";
import { Button, StatusBadge, Surface } from "@/components/ds/primitives";
import { Panel } from "@/components/ds/patterns";

const COLLECTION_LABELS: Record<(typeof DEMO_COLLECTIONS)[number], string> = {
  rooms: "اتاق‌ها",
  teachers: "مدرسان",
  students: "هنرجویان",
  classes: "کلاس‌ها",
  enrollments: "ثبت‌نام‌ها",
  sessions: "جلسات",
  attendance: "حضور و غیاب",
  invoices: "فاکتورها",
  payments: "پرداخت‌ها",
  conversations: "گفتگوها",
  resources: "منابع",
  users: "کاربران",
  roles: "نقش‌ها",
};

/**
 * Demo / Development data controls.
 * Explicitly labelled as demo tooling — these are not production database controls.
 */
export function DemoDataPanel() {
  const { notify } = useApp();
  const { can } = useAuth();
  const demo = useDemoData();
  const mayManage = can("demo.manage");
  const fileInput = useRef<HTMLInputElement>(null);

  const ask = (action: DestructiveAction, payload?: string) => demo.request(action, payload);

  const onConfirm = async () => {
    const result = await demo.confirm();
    notify(
      result.ok
        ? { tone: "success", title: result.message, detail: `مجموع رکوردها: ${faNum(result.stats.total)}` }
        : { tone: "warning", title: result.message, detail: result.issues[0]?.message },
    );
  };

  const onBackup = () => {
    const backup = demo.downloadBackup();
    downloadTextFile(backupFileName(), JSON.stringify(backup, null, 2));
    notify({ tone: "success", title: "پشتیبان دمو ساخته شد", detail: `نسخهٔ ساختار ${backup.schemaVersion}` });
  };

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    ask("restore-backup", await file.text());
  };

  const pending = demo.pending;

  return (
    <>
      <Panel
        title="دادهٔ دمو"
        aside={<StatusBadge tone="violet" label="محیط توسعه" />}
        kicker="این بخش فقط دادهٔ نمایشی مرورگر را مدیریت می‌کند و پایگاه‌دادهٔ واقعی محسوب نمی‌شود."
      >
        <Surface className="border-warn-500/20 bg-warn-500/[0.05] p-3.5 text-[11.5px] leading-relaxed text-ink-200">
          <span className="inline-flex items-center gap-1.5 font-semibold text-warn-400">
            <AlertTriangle className="size-3.5" /> فقط دمو
          </span>{" "}
          دادهٔ این محیط در <span className="nums">localStorage</span> مرورگر شما ذخیره می‌شود، رمز یا توکنی در پشتیبان قرار نمی‌گیرد و
          نباید به‌عنوان دادهٔ عملیاتی استفاده شود.
        </Surface>

        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {DEMO_COLLECTIONS.map((name) => (
            <div key={name} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
              <dt className="text-[11px] text-ink-400">{COLLECTION_LABELS[name]}</dt>
              <dd className="nums mt-0.5 text-[13.5px] font-semibold text-ink-50">{faNum(demo.stats.counts[name])}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="primary" onClick={onBackup}>
            <Download className="size-3.5" /> دریافت پشتیبان
          </Button>
          <Button size="sm" disabled={!mayManage} onClick={() => fileInput.current?.click()}>
            <Upload className="size-3.5" /> بازگردانی از فایل
          </Button>
          <Button size="sm" disabled={!mayManage} onClick={() => ask("reset")}>
            <RotateCcw className="size-3.5" /> بازنشانی به دادهٔ اولیه
          </Button>
          <Button size="sm" disabled={!mayManage} onClick={() => ask("import-seed")}>
            ورود دیتاست کانونیکال
          </Button>
          <Button size="sm" variant="ghost" disabled={!mayManage} className="text-danger-400 hover:text-danger-400" onClick={() => ask("clear")}>
            <Eraser className="size-3.5" /> پاک‌کردن کامل
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="انتخاب فایل پشتیبان"
            onChange={(e) => {
              void onPickFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>

        {!mayManage && (
          <p className="mt-3 text-[11px] text-warn-400">فقط مدیر ارشد می‌تواند عملیات مخرب دادهٔ دمو را اجرا کند.</p>
        )}
        <p className="nums mt-3 text-[11px] text-ink-400">
          نسخهٔ دیتاست {demo.seedVersion} · نسخهٔ ساختار پشتیبان {demo.schemaVersion}
        </p>
      </Panel>

      {pending && (
        <Surface className="border-danger-500/25 bg-danger-500/[0.05] p-4">
          <div className="text-[13.5px] font-semibold text-ink-50">{DESTRUCTIVE_LABELS[pending.action].title}</div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-200">
            {DESTRUCTIVE_LABELS[pending.action].warning} پیش از اجرا یک پشتیبان ایمنی از وضعیت فعلی گرفته می‌شود. این عملیات
            برگشت‌ناپذیر است.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="primary" disabled={demo.busy} onClick={() => void onConfirm()}>
              تأیید و اجرا
            </Button>
            <Button size="sm" variant="ghost" disabled={demo.busy} onClick={demo.cancel}>
              انصراف
            </Button>
          </div>
        </Surface>
      )}

      {demo.issues.length > 0 && (
        <Surface className="border-warn-500/25 bg-warn-500/[0.05] p-4">
          <div className="text-[13px] font-semibold text-warn-400">دادهٔ فعلی تغییر نکرد</div>
          <ul className="mt-2 space-y-1 text-[11.5px] leading-relaxed text-ink-200">
            {demo.issues.slice(0, 6).map((issue, i) => (
              <li key={`${issue.code}-${i}`}>
                <span className="nums text-ink-400">{issue.code}</span> — {issue.message}
              </li>
            ))}
          </ul>
        </Surface>
      )}
    </>
  );
}
