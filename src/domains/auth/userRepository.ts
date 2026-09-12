import { ApiError } from "@/api/errors";
import type { Page, QueryParams } from "@/api/types";
import type { ApiClient } from "@/api/client";
import { demoStore, type DemoStore } from "@/services/demoStore";
import { isRoleId } from "./permissions";
import type { UserRepository } from "./repository";
import type { AuthUser, CreateUserInput, UpdateUserInput } from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Shared, transport-independent input validation. */
export function validateUserInput(input: Partial<CreateUserInput>, required: boolean): ApiError | null {
  const fields: Record<string, string[]> = {};
  if (required || input.name !== undefined) {
    if (!input.name || input.name.trim().length < 2) fields.name = ["نام باید حداقل ۲ نویسه باشد."];
  }
  if (required || input.email !== undefined) {
    if (!input.email || !EMAIL_RE.test(input.email.trim())) fields.email = ["ایمیل معتبر نیست."];
  }
  if (required || input.role !== undefined) {
    if (!input.role || !isRoleId(input.role)) fields.role = ["نقش انتخاب‌شده معتبر نیست."];
  }
  if (Object.keys(fields).length === 0) return null;
  return new ApiError({ kind: "validation", code: "USER_INVALID", message: "اطلاعات کاربر معتبر نیست.", fields });
}

/** Demo implementation — delegates persistence to the single DemoStore. */
export class DemoUserRepository implements UserRepository {
  constructor(private readonly store: DemoStore = demoStore) {}

  async list(): Promise<Page<AuthUser>> {
    const data = this.store.users.all();
    return { data, meta: { page: 1, per_page: data.length || 25, total: data.length } };
  }

  async get(id: string): Promise<AuthUser> {
    const found = this.store.users.find(id);
    if (!found) throw notFound(id);
    return found;
  }

  async create(input: CreateUserInput): Promise<AuthUser> {
    const invalid = validateUserInput(input, true);
    if (invalid) throw invalid;
    if (this.emailTaken(input.email)) throw emailTaken();
    return this.store.users.create({
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      role: input.role,
      status: input.status ?? "active",
    });
  }

  async update(id: string, input: UpdateUserInput): Promise<AuthUser> {
    const invalid = validateUserInput(input, false);
    if (invalid) throw invalid;
    if (input.email && this.emailTaken(input.email, id)) throw emailTaken();
    const updated = this.store.users.update(id, {
      ...input,
      ...(input.email ? { email: input.email.trim().toLowerCase() } : {}),
      ...(input.name ? { name: input.name.trim() } : {}),
    });
    if (!updated) throw notFound(id);
    return updated;
  }

  async delete(id: string): Promise<void> {
    if (!this.store.users.remove(id)) throw notFound(id);
  }

  private emailTaken(email: string, exceptId?: string): boolean {
    const target = email.trim().toLowerCase();
    return this.store.users.all().some((u) => u.email.toLowerCase() === target && u.id !== exceptId);
  }
}

/** REST implementation. BACKEND REQUIRED — no server exists yet. */
export class ApiUserRepository implements UserRepository {
  constructor(private readonly client: ApiClient) {}

  list(signal?: AbortSignal): Promise<Page<AuthUser>> {
    return this.client.getPage<AuthUser>("users", { signal });
  }

  get(id: string): Promise<AuthUser> {
    return this.client.get<AuthUser>(`users/${encodeURIComponent(id)}`);
  }

  create(input: CreateUserInput): Promise<AuthUser> {
    const invalid = validateUserInput(input, true);
    if (invalid) return Promise.reject(invalid);
    return this.client.post<AuthUser>("users", toWire(input));
  }

  update(id: string, input: UpdateUserInput): Promise<AuthUser> {
    const invalid = validateUserInput(input, false);
    if (invalid) return Promise.reject(invalid);
    return this.client.patch<AuthUser>(`users/${encodeURIComponent(id)}`, toWire(input));
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(`users/${encodeURIComponent(id)}`);
  }
}

function toWire(input: UpdateUserInput | CreateUserInput): QueryParams {
  const wire: Record<string, string | undefined> = {
    name: input.name?.trim(),
    email: input.email?.trim().toLowerCase(),
    role: input.role,
    status: input.status,
  };
  return wire as QueryParams;
}

function notFound(id: string): ApiError {
  return new ApiError({ kind: "not_found", code: "USER_NOT_FOUND", message: `کاربر با شناسهٔ ${id} یافت نشد.` });
}

function emailTaken(): ApiError {
  return new ApiError({
    kind: "conflict",
    code: "USER_EMAIL_TAKEN",
    message: "این ایمیل قبلاً ثبت شده است.",
    fields: { email: ["این ایمیل قبلاً ثبت شده است."] },
  });
}
