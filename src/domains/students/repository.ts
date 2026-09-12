import type { Page } from "@/api/types";
import type { CreateStudentInput, Student, StudentListParams, UpdateStudentInput } from "./types";

/**
 * Business-facing contract for student persistence.
 * Implementations: DemoStudentRepository (#1) and ApiStudentRepository (#2).
 *
 * Methods speak in domain ids ("st1"), never in URLs or storage keys.
 * Failures are always `ApiError` instances (see `@/api/errors`).
 */
export interface StudentRepository {
  list(params?: StudentListParams, signal?: AbortSignal): Promise<Page<Student>>;
  get(id: string, signal?: AbortSignal): Promise<Student>;
  create(input: CreateStudentInput): Promise<Student>;
  update(id: string, input: UpdateStudentInput): Promise<Student>;
  delete(id: string): Promise<void>;
}
