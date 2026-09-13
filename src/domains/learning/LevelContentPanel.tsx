/**
 * Content assigned to one level — M3's assignment surface (I3).
 *
 * I3 named the gap: the contract was complete and tested (`listLinks`,
 * `attachContent`, `detachContent`, the `levelContent` collection, link ordering
 * and the `CONTENT_ALREADY_LINKED` conflict) and **only tests called it**. This
 * is the UI and workflow that was missing, and it is deliberately nothing more:
 * no new field, no model change, no domain logic copied into the view.
 *
 * THE WRITE INVARIANT (I13 Checkpoint 2, and the reason this component takes
 * `programId` as a prop at all). `attachContent` is handed the caller's
 * independently resolved program so it can refuse a level that does not belong
 * to it. The value passed here is the program the *programs query* selected —
 * never `level.programId` read back off the row being written to. Two values
 * taken from the same row cannot contradict each other, so a guard built on them
 * proves nothing; the pairing only means something because the two come from
 * different queries.
 *
 * The same discipline applies to the picker's own selection: the id the attach
 * button uses is *derived* from this level's available rows, so a pick made for
 * another level resolves to nothing rather than becoming this level's write
 * target (I13 Checkpoint 1's lesson, applied to local state).
 *
 * Both reads report their own failure. A catalogue that could not be read is
 * rendered as unreadable — never as «nothing left to attach» — and the submit
 * does not exist in that state, so an unavailable offer cannot be written.
 *
 * Nothing here keeps a private copy of the links. Both lists are queries through
 * `useLearningContent`, so a successful write is reflected by the repository's
 * own re-read — driven by the global data-version bump — and the UI cannot claim
 * a link the store does not hold.
 */
import { useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { faNum } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { Button, StatusBadge } from "@/components/ds/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/ds/states";
import { Field, ListRow, inputCls } from "@/components/ds/patterns";
import { apiErrorFromThrown } from "@/api/errors";
import { getLearningRepository } from "@/domains/registry";
import { useLearningContent } from "./useLearning";
import type { LearningContent } from "./types";

/** One line of the picker: the title, plus attribution when the record has it. */
function optionLabel(content: LearningContent): string {
  return content.author ? `${content.title} — ${content.author}` : content.title;
}

export function LevelContentPanel({
  levelId,
  levelName,
  programId,
  programName,
}: {
  /** The rendered row's level — the write target. */
  levelId: string;
  levelName: string;
  /**
   * The program the UI selected, resolved from the programs query. Passed in
   * rather than read off the level, on purpose: see the header.
   */
  programId: string;
  programName: string;
}) {
  const { notify } = useApp();
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState("");

  // Content linked to THIS level. The repository resolves it through the link
  // table, so it is the same source of truth the eligibility rule reads.
  const {
    items: linked,
    loading: linkedLoading,
    error: linkedError,
    reload,
  } = useLearningContent({ levelId, per_page: 200 });

  // The catalogue to pick from. Active only: an inactive item is not something
  // to offer for a new link, though one already linked is still shown honestly.
  //
  // Its `error` is consumed, not discarded: this is a second query with its own
  // failure mode, and a read that failed is not a read that found nothing.
  const {
    items: catalogue,
    loading: catalogueLoading,
    error: catalogueError,
    reload: reloadCatalogue,
  } = useLearningContent({ per_page: 200, activeOnly: true });

  /** In flight until both reads for this level have answered. */
  const pickerLoading = linkedLoading || catalogueLoading;

  const linkedIds = useMemo(() => new Set(linked.map((row) => row.id)), [linked]);

  // Already-linked content is not offered again. This is presentation, not a
  // second rule: `attachContent` still owns the duplicate refusal, and its
  // answer is surfaced verbatim when it happens anyway.
  //
  // A failed catalogue read offers nothing — deliberately, even though the hook
  // keeps the previous page across a failed *refetch*: showing offers beside an
  // error would claim a choice the read cannot currently justify.
  const available = useMemo(
    () =>
      pickerLoading || catalogueError
        ? []
        : catalogue.filter((row) => !linkedIds.has(row.id)),
    [catalogue, linkedIds, pickerLoading, catalogueError],
  );

  // Derived, not stored: a pick made for the previous level is not in this
  // level's `available`, so it collapses to "" and the attach button disables
  // instead of writing the previous level's choice to this one.
  const pickedId = available.some((row) => row.id === picked) ? picked : "";

  const attach = async () => {
    const content = available.find((row) => row.id === pickedId);
    if (!content || busy) return;
    setBusy(true);
    try {
      await getLearningRepository().attachContent(levelId, content.id, { programId });
      // Success is reported only after the write resolved, and the list below
      // refreshes from the repository rather than from anything set here.
      notify({
        tone: "success",
        title: `«${content.title}» به این سطح متصل شد`,
        detail: `دسترسی هنرجوهای دورهٔ «${programName}» بر اساس سطح «${levelName}» بازمحاسبه شد.`,
      });
      setPicked("");
    } catch (cause) {
      // Includes CONTENT_ALREADY_LINKED and LINK_INVALID: the repository's own
      // Persian message is the honest refusal, so it is shown unedited.
      notify({
        tone: "danger",
        title: "اتصال منبع انجام نشد",
        detail: apiErrorFromThrown(cause).message,
      });
    } finally {
      setBusy(false);
    }
  };

  const detach = async (content: LearningContent) => {
    if (busy) return;
    setBusy(true);
    try {
      await getLearningRepository().detachContent(levelId, content.id);
      notify({
        tone: "success",
        title: `«${content.title}» از این سطح جدا شد`,
        detail: "خود منبع حذف نشد؛ فقط پیوند آن با این سطح برداشته شد.",
      });
    } catch (cause) {
      notify({
        tone: "danger",
        title: "جدا کردن منبع انجام نشد",
        detail: apiErrorFromThrown(cause).message,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="level-content-heading"
      className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <BookOpen className="size-3.5 text-gold-400" aria-hidden />
        <h3 id="level-content-heading" className="text-[11px] font-medium text-ink-400">
          {/*
            The count is withheld while the read is in flight: mid-switch the
            list legitimately holds nothing yet, and «۰ منبع» for a level that
            has four is the same false count I13 was about.
          */}
          منابع سطح «{levelName}» در دورهٔ «{programName}»
          {linkedLoading ? "" : ` — ${faNum(linked.length)} منبع`}
        </h3>
      </div>

      {linkedError ? (
        <ErrorState
          title="بارگذاری منابع این سطح ناموفق بود"
          description={linkedError.message}
          onRetry={reload}
        />
      ) : linkedLoading ? (
        <LoadingState label="در حال بارگذاری منابع این سطح…" />
      ) : linked.length === 0 ? (
        <EmptyState
          title="منبعی به این سطح متصل نیست"
          description="هنرجویی که روی این سطح قرار بگیرد، تا زمان اتصال منبع چیزی برای باز کردن ندارد."
        />
      ) : (
        <ul className="space-y-2">
          {linked.map((content) => (
            <li key={content.id}>
              <ListRow
                title={content.title}
                meta={content.author ?? (content.description || "بدون توضیح")}
                end={
                  <span className="flex items-center gap-1.5">
                    {!content.active && (
                      <StatusBadge tone="neutral" label="غیرفعال" glyph={false} />
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void detach(content)}
                    >
                      جدا کردن
                    </Button>
                  </span>
                }
              />
            </li>
          ))}
        </ul>
      )}

      {catalogueError ? (
        /*
          The offers could not be read, so «منبعی برای اتصال باقی نمانده» would
          be a false empty — the same shape I13 Checkpoint 1 removed from six
          consumers, in a new place. The level's own links above are untouched
          (that read answered), so only the add affordance is replaced, with the
          failure's own message and a retry; there is no submit to press.
        */
        <ErrorState
          className="mt-3 px-4 py-6"
          title="فهرست منابع قابل اتصال خوانده نشد"
          description={catalogueError.message}
          onRetry={reloadCatalogue}
        />
      ) : (
        <form
          className="mt-3 flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void attach();
          }}
        >
          <Field
            label="منبع جدید"
            hint={`از میان منابع فعال؛ سطح «${levelName}»`}
            className="flex-1"
          >
            {(control) => (
              <select
                {...control}
                className={inputCls}
                value={pickedId}
                disabled={busy || pickerLoading}
                onChange={(event) => setPicked(event.target.value)}
              >
                {/*
                  An empty option list while loading is not a false empty: the
                  control is disabled and says it is loading, which is the
                  explicit in-flight state I13 asks for instead of another
                  query's rows.
                */}
                <option value="">
                  {pickerLoading
                    ? "در حال بارگذاری منابع…"
                    : available.length === 0
                      ? "منبعی برای اتصال باقی نمانده"
                      : "— انتخاب کنید —"}
                </option>
                {available.map((content) => (
                  <option key={content.id} value={content.id}>
                    {optionLabel(content)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Button
            type="submit"
            size="sm"
            variant="subtle"
            className="mb-[2px]"
            disabled={busy || pickerLoading || !pickedId}
          >
            {busy ? "در حال ثبت…" : "اتصال"}
          </Button>
        </form>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
        اتصال منبع به یک سطح، دسترسی هر هنرجویی را که روی آن سطح یا سطوح بعدی
        این دوره قرار دارد فوراً تغییر می‌دهد؛ منبع برای هیچ هنرجویی کپی نمی‌شود.
      </p>
    </section>
  );
}
