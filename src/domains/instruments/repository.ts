import type { Page } from "@/api/types";
import type {
  CreateInstrumentInput,
  InstrumentListParams,
  InstrumentRecord,
  UpdateInstrumentInput,
} from "./types";

export interface InstrumentRepository {
  list(params?: InstrumentListParams, signal?: AbortSignal): Promise<Page<InstrumentRecord>>;
  get(id: string, signal?: AbortSignal): Promise<InstrumentRecord>;
  create(input: CreateInstrumentInput): Promise<InstrumentRecord>;
  update(id: string, input: UpdateInstrumentInput): Promise<InstrumentRecord>;
  /** Soft state change; historical records keep referencing the instrument. */
  setActive(id: string, active: boolean): Promise<InstrumentRecord>;
  /** Refused while any teacher, student, class or program still references it. */
  delete(id: string): Promise<void>;
}
