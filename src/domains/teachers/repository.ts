import type { Page } from "@/api/types";
import type { CreateTeacherInput, Teacher, TeacherListParams, UpdateTeacherInput } from "./types";

/**
 * Business-facing contract for teacher persistence.
 * Implementations: DemoTeacherRepository (#1) and ApiTeacherRepository (#2).
 * Methods speak in domain ids ("t1"), never URLs or storage keys.
 */
export interface TeacherRepository {
  list(params?: TeacherListParams, signal?: AbortSignal): Promise<Page<Teacher>>;
  get(id: string, signal?: AbortSignal): Promise<Teacher>;
  create(input: CreateTeacherInput): Promise<Teacher>;
  update(id: string, input: UpdateTeacherInput): Promise<Teacher>;
  /** Soft-deactivate; historical assignments are preserved. */
  deactivate(id: string): Promise<Teacher>;
  delete(id: string): Promise<void>;
}
