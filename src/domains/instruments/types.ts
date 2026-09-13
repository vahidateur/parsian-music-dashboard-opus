/**
 * Instrument domain types.
 *
 * Instruments are runtime data. The former closed union
 * (`"piano" | "guitar" | …`) and its exhaustive `instrumentLabel` map have been
 * removed: an academy defines its own instruments, which a compile-time union
 * cannot express.
 *
 * Fields that reference an instrument are typed `InstrumentId` (a string alias
 * in `@/data/academy`) and hold an `InstrumentRecord.id`. Resolve one to a
 * Persian name with `instrumentName()` from `./catalog`, which is the single
 * synchronous source of truth and is kept in step with this repository.
 *
 * The six seeded instruments keep their historical ids (`piano`, `violin`, …)
 * because existing records, backups and previously exported files all store
 * those strings.
 *
 * MULTI-TENANCY (§21): production `instruments` needs `organization_id`, with
 * `UNIQUE(organization_id, slug)` rather than a globally unique id.
 */
import type { ListParams } from "@/api/types";

/** A teachable instrument (or subject, e.g. theory) offered by the academy. */
export interface InstrumentRecord {
  id: string;
  /** Persian display name, e.g. "ویولن". */
  name: string;
  /**
   * Stable machine key, equal to `id`. For seeded rows this is the historical
   * identifier (`"violin"`), which is what keeps existing data resolvable.
   */
  slug: string;
  /** Short Persian description shown on the instrument card. */
  description: string;
  /**
   * Reference to an image in the media domain (`MediaAsset.id`).
   * Never a raw data URL — see `src/domains/media/types.ts` for why.
   */
  imageId?: string;
  /** Inactive instruments stay on historical records but leave new pickers. */
  active: boolean;
  /** Manual ordering in pickers; lower sorts first. */
  sortOrder: number;
}

export interface InstrumentListParams extends ListParams {
  search?: string;
  /** Only instruments offered for new assignments. */
  activeOnly?: boolean;
}

export type CreateInstrumentInput = Omit<InstrumentRecord, "id" | "sortOrder"> &
  Partial<Pick<InstrumentRecord, "sortOrder">>;

export type UpdateInstrumentInput = Partial<Omit<InstrumentRecord, "id">>;
