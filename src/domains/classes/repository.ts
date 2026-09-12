import type { Page } from "@/api/types";
import type { AcademyClass, ClassListParams, CreateClassInput, UpdateClassInput } from "./types";

export interface ClassRepository {
  list(params?: ClassListParams, signal?: AbortSignal): Promise<Page<AcademyClass>>;
  get(id: string, signal?: AbortSignal): Promise<AcademyClass>;
  create(input: CreateClassInput): Promise<AcademyClass>;
  update(id: string, input: UpdateClassInput): Promise<AcademyClass>;
  /** Archive: preserves history, removes the class from new enrollment. */
  archive(id: string): Promise<AcademyClass>;
  delete(id: string): Promise<void>;
}
