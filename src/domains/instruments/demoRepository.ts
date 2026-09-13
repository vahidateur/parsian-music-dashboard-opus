/**
 * Demo instrument repository.
 *
 * Owns the instrument invariants: unique slug, unique name, and referential
 * safety on delete. As everywhere else in this codebase the dialog's checks
 * are convenience; these are the rules.
 */
import type { Page } from "@/api/types";
import { conflict, matchesQuery, notFound, paginate, sortRows, validationError } from "@/domains/shared/demoCollection";
import { demoStore, type DemoStore } from "@/services/demoStore";
import type { InstrumentRepository } from "./repository";
import type {
  CreateInstrumentInput,
  InstrumentListParams,
  InstrumentRecord,
  UpdateInstrumentInput,
} from "./types";

/**
 * Slugs are machine keys used as ids, so they are restricted to a safe,
 * URL-usable alphabet. This also prevents a crafted slug from colliding with
 * an existing id or carrying path characters.
 */
const SLUG_PATTERN = /^[a-z][a-z0-9_-]{1,30}$/;

export class DemoInstrumentRepository implements InstrumentRepository {
  constructor(private readonly store: DemoStore = demoStore) {}

  async list(params: InstrumentListParams = {}): Promise<Page<InstrumentRecord>> {
    const rows = this.store.instruments.all().filter((row) => {
      if (params.activeOnly && !row.active) return false;
      return matchesQuery([row.name, row.slug, row.description], params.search);
    });
    return paginate(sortRows(rows, (row) => row.sortOrder), params);
  }

  async get(id: string): Promise<InstrumentRecord> {
    const found = this.store.instruments.find(id);
    if (!found) throw notFound("INSTRUMENT_NOT_FOUND", `ساز با شناسهٔ ${id} یافت نشد.`);
    return found;
  }

  async create(input: CreateInstrumentInput): Promise<InstrumentRecord> {
    this.assertValid(input);
    this.assertUnique(input.slug, input.name);

    const rows = this.store.instruments.all();
    const sortOrder = input.sortOrder ?? rows.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 1;

    // The slug doubles as the id so a new instrument is referenced the same way
    // a seeded one is, keeping every existing `instrument: "<slug>"` field valid.
    return this.store.instruments.create({ ...input, id: input.slug, sortOrder });
  }

  async update(id: string, input: UpdateInstrumentInput): Promise<InstrumentRecord> {
    const existing = await this.get(id);
    // The slug is an identity key; renaming it would orphan every record that
    // stores it. Display name stays freely editable.
    if (input.slug !== undefined && input.slug !== existing.slug) {
      throw validationError("INSTRUMENT_INVALID", "شناسهٔ فنی ساز پس از ایجاد قابل تغییر نیست.", {
        slug: ["قابل تغییر نیست"],
      });
    }
    if (input.name !== undefined) {
      this.assertValid({ ...existing, ...input });
      this.assertUnique(existing.slug, input.name, id);
    }
    const updated = this.store.instruments.update(id, input);
    if (!updated) throw notFound("INSTRUMENT_NOT_FOUND", `ساز با شناسهٔ ${id} یافت نشد.`);
    return updated;
  }

  async setActive(id: string, active: boolean): Promise<InstrumentRecord> {
    await this.get(id);
    const updated = this.store.instruments.update(id, { active });
    if (!updated) throw notFound("INSTRUMENT_NOT_FOUND", `ساز با شناسهٔ ${id} یافت نشد.`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.get(id);
    const blocker = this.findReference(id);
    if (blocker) {
      throw conflict(
        "INSTRUMENT_IN_USE",
        `این ساز در ${blocker} استفاده شده است؛ به‌جای حذف، آن را غیرفعال کنید.`,
      );
    }
    this.store.instruments.remove(id);
  }

  /**
   * Returns a Persian description of the first thing still using this
   * instrument, or undefined when it is genuinely unreferenced.
   *
   * Checked in cheapest-first order so the common "it is in use" case exits
   * without scanning every collection.
   */
  private findReference(id: string): string | undefined {
    if (this.store.programs.all().some((p) => p.instrumentId === id)) return "برنامه‌های آموزشی";
    if (this.store.teachers.all().some((t) => t.instrument === id)) return "پروندهٔ مدرسان";
    if (this.store.students.all().some((s) => s.instrument === id)) return "پروندهٔ هنرجویان";
    if (this.store.classes.all().some((c) => c.instrument === id)) return "کلاس‌ها";
    return undefined;
  }

  private assertValid(input: { name: string; slug: string }): void {
    const fields: Record<string, string[]> = {};
    if (input.name.trim().length < 2) fields.name = ["نام ساز الزامی است."];
    if (!SLUG_PATTERN.test(input.slug)) {
      fields.slug = ["شناسهٔ فنی باید با حرف انگلیسی شروع شود و فقط شامل حروف کوچک، عدد، خط تیره و زیرخط باشد."];
    }
    if (Object.keys(fields).length) {
      throw validationError("INSTRUMENT_INVALID", "اطلاعات ساز معتبر نیست.", fields);
    }
  }

  private assertUnique(slug: string, name: string, exceptId?: string): void {
    const rows = this.store.instruments.all();
    if (rows.some((row) => row.id !== exceptId && row.slug === slug)) {
      throw conflict("INSTRUMENT_SLUG_TAKEN", "سازی با این شناسهٔ فنی وجود دارد.", { slug: ["تکراری است"] });
    }
    const normalized = name.trim();
    if (rows.some((row) => row.id !== exceptId && row.name.trim() === normalized)) {
      throw conflict("INSTRUMENT_NAME_TAKEN", "سازی با این نام وجود دارد.", { name: ["تکراری است"] });
    }
  }
}
