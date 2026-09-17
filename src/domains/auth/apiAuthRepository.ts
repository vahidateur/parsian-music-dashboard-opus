import type { ApiClient } from "@/api/client";
import { ApiError, isApiError } from "@/api/errors";
import { isPermission, permissionsForRole, isRoleId, type Permission } from "./permissions";
import type { AuthRepository } from "./repository";
import type { AuthUser, LoginInput, Session } from "./types";

/**
 * Real authentication against a REST backend.
 *
 *   POST /api/v1/auth/login    → { data: { user, permissions, token, expires_at } }
 *   POST /api/v1/auth/logout
 *   GET  /api/v1/auth/me
 *
 * The server is the only authority for identity AND authorization; the
 * permissions returned here drive UI affordances only.
 *
 * BACKEND REQUIRED: this class is wired but has no server to talk to yet. It is
 * selected only when VITE_DATA_SOURCE=api.
 */

interface WireSession {
  user?: unknown;
  permissions?: unknown;
  token?: unknown;
  expires_at?: unknown;
  expiresAt?: unknown;
}

export class ApiAuthRepository implements AuthRepository {
  constructor(
    private readonly client: ApiClient,
    /** Lets the composition root learn about a new token. */
    private readonly onSession: (session: Session | null) => void = () => {},
  ) {}

  async login(input: LoginInput): Promise<Session> {
    const raw = await this.client.post<WireSession>("auth/login", { email: input.email, password: input.password });
    const session = toSession(raw);
    this.onSession(session);
    return session;
  }

  async logout(): Promise<void> {
    try {
      await this.client.post("auth/logout");
    } finally {
      this.onSession(null);
    }
  }

  async restore(): Promise<Session | null> {
    try {
      return await this.me();
    } catch (error) {
      if (isApiError(error) && (error.kind === "authentication" || error.kind === "authorization")) {
        this.onSession(null);
        return null;
      }
      throw error;
    }
  }

  async me(): Promise<Session> {
    const session = toSession(await this.client.get<WireSession>("auth/me"));
    this.onSession(session);
    return session;
  }
}

/** Validates the wire payload; the server response is untrusted input. */
export function toSession(raw: WireSession): Session {
  const user = toUser(raw.user);
  const expiresRaw = raw.expires_at ?? raw.expiresAt;
  return {
    user,
    permissions: toPermissions(raw.permissions, user),
    token: typeof raw.token === "string" ? raw.token : "",
    expiresAt: typeof expiresRaw === "string" ? expiresRaw : new Date(Date.now() + 3_600_000).toISOString(),
  };
}

function toUser(value: unknown): AuthUser {
  if (typeof value !== "object" || value === null) {
    throw new ApiError({ kind: "server", code: "AUTH_BAD_PAYLOAD", message: "پاسخ سرور برای کاربر معتبر نیست." });
  }
  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === "string" ? raw.id : "";
  const role = typeof raw.role === "string" && isRoleId(raw.role) ? raw.role : "staff";
  if (!id) {
    throw new ApiError({ kind: "server", code: "AUTH_BAD_PAYLOAD", message: "پاسخ سرور برای کاربر معتبر نیست." });
  }
  const now = new Date().toISOString();
  return {
    id,
    name: typeof raw.name === "string" ? raw.name : "",
    email: typeof raw.email === "string" ? raw.email : "",
    role,
    status: raw.status === "disabled" ? "disabled" : "active",
    createdAt: typeof raw.created_at === "string" ? raw.created_at : now,
    updatedAt: typeof raw.updated_at === "string" ? raw.updated_at : now,
  };
}

/** Server-provided permissions win; fall back to the local matrix if absent. */
function toPermissions(value: unknown, user: AuthUser): Permission[] {
  if (Array.isArray(value)) {
    return value.filter((p): p is Permission => typeof p === "string" && isPermission(p));
  }
  return permissionsForRole(user.role);
}
