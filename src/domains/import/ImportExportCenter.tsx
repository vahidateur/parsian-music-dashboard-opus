/**
 * Import/Export Center.
 *
 * Import is a deliberate, reversible-until-committed wizard:
 *   upload → detect & parse → map columns → validate everything → confirm → commit → report
 *
 * The store is not touched until the user confirms at the last step, and the
 * default commit mode refuses to write anything if the file contains invalid
 * rows. Nothing is uploaded to a server: parsing happens in the browser.
 */
import { useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Button, StatusBadge, Surface } from "@/components/ds/primitives";
import { Panel, Segmented } from "@/components/ds/patterns";
import { EmptyState } from "@/components/ds/states";
import { EXPORT_LABELS, downloadTable, exportEntity, type ExportEntity, type ExportFormat } from "@/domains/export/exportService";
import { cn } from "@/utils/cn";
import { MAX_FILE_BYTES, SpreadsheetError, parseSpreadsheet, type SheetData } from "./spreadsheet";
import {
  STUDENT_FIELDS,
  autoMapColumns,
  commitStudentImport,
  errorReportRows,
  loadStudentImportContext,
  studentTemplate,
  validateStudentRows,
} from "./studentImport";
import type { ColumnMapping, ImportResult, ValidationReport } from "./types";
import type { CreateStudentInput } from "@/domains/students/types";

type Step = "upload" | "map" | "review" | "done";

const PREVIEW_ROWS = 8;

export function ImportExportCenter() {
  const { notify } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [filename, setFilename] = useState("");
  const [sheet, setSheet] = useState<SheetData | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [report, setReport] = useState<ValidationReport<CreateStudentInput> | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [atomic, setAtomic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [exportEntityName, setExportEntityName] = useState<ExportEntity>("students");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");

  const reset = () => {
    setStep("upload");
    setSheet(null);
    setMapping({});
    setReport(null);
    setResult(null);
    setParseError(null);
    setFilename("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const onFile = async (file: File) => {
    setParseError(null);
    setBusy(true);
    try {
      if (file.size > MAX_FILE_BYTES) {
        throw new SpreadsheetError(`حجم فایل بیش از ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} مگابایت است.`);
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const parsed = parseSpreadsheet(bytes, file.name);
      setSheet(parsed);
      setFilename(file.name);
      setMapping(autoMapColumns(parsed.headers, STUDENT_FIELDS));
      setStep("map");
    } catch (cause) {
      setParseError(cause instanceof Error ? cause.message : "خواندن فایل ممکن نبود.");
    } finally {
      setBusy(false);
    }
  };

  const runValidation = async () => {
    if (!sheet) return;
    setBusy(true);
    try {
      const context = await loadStudentImportContext();
      setReport(validateStudentRows(sheet.rows, mapping, context));
      setStep("review");
    } catch {
      setParseError("خواندن دادهٔ فعلی برای بررسی تکراری‌ها ممکن نشد.");
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!report) return;
    setBusy(true);
    try {
      const outcome = await commitStudentImport(report, { atomic });
      setResult(outcome);
      setStep("done");
      notify({
        tone: outcome.imported > 0 ? "success" : "danger",
        title: outcome.imported > 0 ? "ورود اطلاعات انجام شد" : "هیچ رکوردی وارد نشد",
        detail: outcome.message,
      });
    } finally {
      setBusy(false);
    }
  };

  const missingRequired = useMemo(
    () => STUDENT_FIELDS.filter((f) => f.required && (mapping[f.key] === null || mapping[f.key] === undefined)),
    [mapping],
  );

  const runExport = async () => {
    setBusy(true);
    try {
      const count = await exportEntity(exportEntityName, exportFormat);
      notify({
        tone: "success",
        title: "خروجی آماده شد",
        detail: `${count} سطر از ${EXPORT_LABELS[exportEntityName]} در قالب ${exportFormat.toUpperCase()} دانلود شد.`,
      });
    } catch {
      notify({ tone: "danger", title: "تهیهٔ خروجی ناموفق بود", detail: "دادهٔ فعلی خوانده نشد." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4">
      {/* ---------------- Export ---------------- */}
      <Panel title="خروجی گرفتن" kicker="بر اساس وضعیت فعلی داده‌ها، نه دادهٔ نمونه">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-200">موجودیت</span>
            <Segmented
              value={exportEntityName}
              onChange={setExportEntityName}
              options={(Object.keys(EXPORT_LABELS) as ExportEntity[]).map((key) => ({ value: key, label: EXPORT_LABELS[key] }))}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-200">قالب</span>
            <Segmented
              value={exportFormat}
              onChange={setExportFormat}
              options={[
                { value: "csv", label: "CSV" },
                { value: "xlsx", label: "Excel" },
              ]}
            />
          </label>
          <Button variant="primary" onClick={() => void runExport()} disabled={busy}>
            <Download className="size-3.5" /> دانلود خروجی
          </Button>
        </div>
        <p className="mt-3 text-[11.5px] leading-relaxed text-ink-400">
          خروجی CSV با BOM ذخیره می‌شود تا اکسل متن فارسی را درست بخواند. مقادیری که با «=» یا «+» شروع شوند به‌صورت متن ذخیره می‌شوند تا
          به‌عنوان فرمول اجرا نشوند.
        </p>
      </Panel>

      {/* ---------------- Import ---------------- */}
      <Panel
        title="ورود اطلاعات هنرجویان"
        kicker="CSV یا Excel · بررسی کامل پیش از ذخیره"
        action={step !== "upload" ? "شروع دوباره" : undefined}
        onAction={step !== "upload" ? reset : undefined}
      >
        <ol className="mb-4 flex flex-wrap items-center gap-2 text-[11px]" aria-label="مراحل ورود اطلاعات">
          {(
            [
              ["upload", "۱ · انتخاب فایل"],
              ["map", "۲ · تطبیق ستون‌ها"],
              ["review", "۳ · بررسی و تأیید"],
              ["done", "۴ · گزارش"],
            ] as const
          ).map(([key, label]) => (
            <li
              key={key}
              aria-current={step === key ? "step" : undefined}
              className={cn(
                "rounded-lg border px-2.5 py-1",
                step === key ? "border-gold-500/40 bg-gold-500/10 text-gold-300" : "border-white/[0.07] text-ink-400",
              )}
            >
              {label}
            </li>
          ))}
        </ol>

        {parseError && (
          <p role="alert" className="mb-3 rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-[12px] text-danger-400">
            {parseError}
          </p>
        )}

        {step === "upload" && (
          <div className="grid gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              id="import-file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFile(file);
              }}
            />
            <Surface className="flex flex-col items-center gap-3 border-dashed p-8 text-center">
              <FileSpreadsheet className="size-8 text-ink-400" strokeWidth={1.5} />
              <div>
                <p className="text-[13px] text-ink-100">فایل CSV یا Excel هنرجویان را انتخاب کنید</p>
                <p className="mt-1 text-[11.5px] text-ink-400">
                  حداکثر {Math.round(MAX_FILE_BYTES / 1024 / 1024)} مگابایت · فایل روی همین دستگاه پردازش می‌شود و جایی ارسال نمی‌شود.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" onClick={() => fileRef.current?.click()} disabled={busy}>
                  <Upload className="size-3.5" /> {busy ? "در حال خواندن…" : "انتخاب فایل"}
                </Button>
                <Button
                  variant="subtle"
                  onClick={() => downloadTable(studentTemplate(), "قالب-هنرجویان.csv", "csv", "هنرجویان")}
                >
                  <Download className="size-3.5" /> دانلود قالب نمونه
                </Button>
              </div>
            </Surface>
          </div>
        )}

        {step === "map" && sheet && (
          <div className="grid gap-4">
            <p className="text-[12px] text-ink-300">
              فایل <span className="text-ink-100">{filename}</span> با {sheet.rows.length} سطر خوانده شد. ستون‌های فایل را به فیلدهای سامانه
              نسبت دهید.
            </p>

            <div className="grid gap-2.5 sm:grid-cols-2">
              {STUDENT_FIELDS.map((field) => (
                <label key={field.key} className="block">
                  <span className="mb-1.5 flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium text-ink-200">
                      {field.label}
                      {field.required && (
                        <span className="ms-1 text-danger-400" aria-hidden>
                          *
                        </span>
                      )}
                    </span>
                    {field.hint && <span className="text-[10.5px] text-ink-500">{field.hint}</span>}
                  </span>
                  <select
                    className="h-10 w-full rounded-xl border border-white/[0.08] bg-ink-850 px-3.5 text-[13px] text-ink-50 outline-none focus:border-gold-500/50"
                    value={mapping[field.key] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [field.key]: e.target.value === "" ? null : Number(e.target.value) }))}
                  >
                    <option value="">— نادیده بگیر —</option>
                    {sheet.headers.map((header, index) => (
                      <option key={`${header}-${index}`} value={index}>
                        {header || `ستون ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-right text-[11.5px]">
                <caption className="mb-2 text-start text-[11px] text-ink-400">پیش‌نمایش {Math.min(PREVIEW_ROWS, sheet.rows.length)} سطر اول</caption>
                <thead>
                  <tr className="text-ink-400">
                    {sheet.headers.map((header, i) => (
                      <th key={`${header}-${i}`} scope="col" className="border-b border-white/[0.06] px-2 py-1.5 font-medium">
                        {header || `ستون ${i + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sheet.rows.slice(0, PREVIEW_ROWS).map((row, r) => (
                    <tr key={r} className="text-ink-200">
                      {sheet.headers.map((_, c) => (
                        <td key={c} className="border-b border-white/[0.04] px-2 py-1.5">
                          {row[c] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {missingRequired.length > 0 && (
              <p role="alert" className="text-[12px] text-warn-400">
                ستون‌های الزامی تطبیق داده نشده‌اند: {missingRequired.map((f) => f.label).join("، ")}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="subtle" onClick={reset}>
                انصراف
              </Button>
              <Button variant="primary" onClick={() => void runValidation()} disabled={busy || missingRequired.length > 0}>
                {busy ? "در حال بررسی…" : "بررسی اعتبار داده‌ها"}
              </Button>
            </div>
          </div>
        )}

        {step === "review" && report && (
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone="ok" label={`${report.valid.length} سطر معتبر`} />
              <StatusBadge tone={report.failed.length ? "danger" : "neutral"} label={`${report.failed.length} سطر نامعتبر`} />
              <StatusBadge tone={report.duplicates ? "warn" : "neutral"} label={`${report.duplicates} کد ملی تکراری`} />
              <StatusBadge tone={report.warnings.length ? "warn" : "neutral"} label={`${report.warnings.length} هشدار`} />
            </div>

            {report.errors.length > 0 && (
              <div className="max-h-56 overflow-y-auto rounded-xl border border-white/[0.06]">
                <table className="w-full text-right text-[11.5px]">
                  <caption className="sr-only">فهرست خطاهای اعتبارسنجی</caption>
                  <thead className="sticky top-0 bg-ink-900 text-ink-400">
                    <tr>
                      <th scope="col" className="px-2.5 py-1.5 font-medium">سطر</th>
                      <th scope="col" className="px-2.5 py-1.5 font-medium">ستون</th>
                      <th scope="col" className="px-2.5 py-1.5 font-medium">پیام</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.errors.slice(0, 100).map((issue, i) => (
                      <tr key={i} className="border-t border-white/[0.04]">
                        <td className="nums px-2.5 py-1.5 text-ink-200">{issue.row}</td>
                        <td className="px-2.5 py-1.5 text-ink-300">{issue.field}</td>
                        <td className="px-2.5 py-1.5 text-danger-400">{issue.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <label className="flex items-start gap-2.5 rounded-xl border border-white/[0.07] p-3">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[var(--color-gold-500)]"
                checked={atomic}
                onChange={(e) => setAtomic(e.target.checked)}
              />
              <span className="text-[12px] leading-relaxed text-ink-200">
                اگر حتی یک سطر نامعتبر باشد، هیچ رکوردی وارد نشود.
                <span className="mt-0.5 block text-[11px] text-ink-400">
                  با برداشتن این گزینه، فقط سطرهای معتبر وارد می‌شوند و بقیه در گزارش خطا می‌آیند.
                </span>
              </span>
            </label>

            <div className="flex flex-wrap justify-end gap-2">
              {report.errors.length > 0 && (
                <Button
                  variant="subtle"
                  onClick={() => downloadTable(errorReportRows([...report.errors, ...report.warnings]), "گزارش-خطا.csv", "csv", "خطاها")}
                >
                  <Download className="size-3.5" /> دانلود گزارش خطا
                </Button>
              )}
              <Button variant="subtle" onClick={() => setStep("map")}>
                بازگشت
              </Button>
              <Button
                variant="primary"
                onClick={() => void commit()}
                disabled={busy || report.valid.length === 0 || (atomic && report.failed.length > 0)}
              >
                {busy ? "در حال ذخیره…" : `ورود ${report.valid.length} سطر`}
              </Button>
            </div>
          </div>
        )}

        {step === "done" && result && (
          <div className="grid gap-3">
            <EmptyState
              title={result.imported > 0 ? "ورود اطلاعات کامل شد" : "هیچ رکوردی وارد نشد"}
              description={result.message}
              action="ورود فایل دیگر"
              onAction={reset}
            />
            {(result.errors.length > 0 || result.warnings.length > 0) && (
              <div className="flex justify-center">
                <Button
                  variant="subtle"
                  onClick={() => downloadTable(errorReportRows([...result.errors, ...result.warnings]), "گزارش-خطا.csv", "csv", "خطاها")}
                >
                  <Download className="size-3.5" /> دانلود گزارش کامل
                </Button>
              </div>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
