import { ApiError } from "@/api/errors";
import type { Page, QueryParams } from "@/api/types";
import type { ApiClient } from "@/api/client";
import { isAcceptablePassphrase } from "./passphrase";
import { isRoleId } from "./permissions";
import type { UserRepository } from "./repository";
import type { AuthUser, CreateUserInput, UpdateUserInput } from "./types";

/*
  The local implementation of this interface lives in `./localUserRepository` —
  deliberately NOT co-located: it imports the demo store and the credential
  store, and those imports in this shared file leak the demo persistence graph
  into the client bundle (see localUserRepository.ts). */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Persian and Latin digits, spaces, `+`, `-` — a contact number, loosely. */
const PHONE_RE = /^[0-9۰-۹+\-\s()]{6,20}$/;

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
  if (input.phone !== undefined && input.phone !== "" && !PHONE_RE.test(input.phone.trim())) {
    fields.phone = ["شمارهٔ تماس معتبر نیست."];
  }
  if (Object.keys(fields).length === 0) return null;
  return new ApiError({ kind: "validation", code: "USER_INVALID", message: "اطلاعات کاربر معتبر نیست.", fields });
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

  /** BACKEND REQUIRED: `POST /users/{id}/password`, verified server-side. */
  setPassword(id: string, passphrase: string): Promise<void> {
    if (passphrase !== "" && !isAcceptablePassphrase(passphrase)) return Promise.reject(weakPassphrase());
    return this.client
      .post<void>(`users/${encodeURIComponent(id)}/password`, { password: passphrase })
      .then(() => undefined);
  }

  /** BACKEND REQUIRED: the server answers whether a local passphrase exists. */
  hasOwnPassword(id: string): Promise<boolean> {
    return this.client
      .get<{ has_password: boolean }>(`users/${encodeURIComponent(id)}/password`)
      .then((body) => Boolean(body?.has_password))
      .catch(() => false);
  }
}

function toWire(input: UpdateUserInput | CreateUserInput): QueryParams {
  const wire: Record<string, string | undefined> = {
    name: input.name?.trim(),
    email: input.email?.trim().toLowerCase(),
    phone: input.phone?.trim(),
    role: input.role,
    status: input.status,
  };
  return wire as QueryParams;
}

export function weakPassphrase(): ApiError {
  return new ApiError({
    kind: "validation",
    code: "USER_PASSWORD_WEAK",
    message: "گذرواژه باید حداقل ۶ نویسه باشد.",
    fields: { password: ["گذرواژه باید حداقل ۶ نویسه باشد."] },
  });
}

export function notFound(id: string): ApiError {
  return new ApiError({ kind: "not_found", code: "USER_NOT_FOUND", message: `کاربر با شناسهٔ ${id} یافت نشد.` });
}

export function emailTaken(): ApiError {
  return new ApiError({
    kind: "conflict",
    code: "USER_EMAIL_TAKEN",
    message: "این ایمیل قبلاً ثبت شده است.",
    fields: { email: ["این ایمیل قبلاً ثبت شده است."] },
  });
}
