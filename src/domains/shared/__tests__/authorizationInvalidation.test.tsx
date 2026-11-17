// @vitest-environment jsdom
/**
 * Stage 16 — a resource-level 403 must not leave previously authorized data on
 * screen, and it must not be confused with a session, not-found, or server
 * failure.
 *
 * These cases exercise the real read hooks and the real error taxonomy:
 *  - the denied read drops its own page;
 *  - an unrelated read keeps its page;
 *  - 401/404/5xx keep their existing meaning;
 *  - a late answer from an old query/tenant cannot repopulate the cache;
 *  - a retry restores data only after a successful read;
 *  - the role-policy lifecycle and the authenticated session are untouched.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/errors";
import { emptyPage, type Page } from "@/api/types";
import { AuthProvider, useAuth } from "@/domains/auth/AuthContext";
import {
  beginRolePolicyRequest,
  beginRolePolicySession,
  clearRolePolicies,
  commitRolePolicy,
  getRolePolicyState,
} from "@/domains/auth/permissions";
import type { AuthRepository } from "@/domains/auth/repository";
import { defaultRoleRecord } from "@/domains/auth/roleRepository";
import type { Session } from "@/domains/auth/types";
import { useMediaObjectState } from "@/domains/media/useMedia";
import type { MediaRepository } from "@/domains/media/repository";
import { resetRegistry, setMediaRepository, setTeacherRepository } from "@/domains/registry";
import { useResourceList } from "@/domains/shared/useResource";
import type { TeacherRepository } from "@/domains/teachers/repository";
import type { Teacher } from "@/domains/teachers/types";
import { useTeachers } from "@/domains/teachers/useTeachers";

interface Row {
  id: string;
}

function page(ids: string[]): Page<Row> {
  return { data: ids.map((id) => ({ id })), meta: { page: 1, per_page: ids.length || 25, total: ids.length } };
}

const denied = () => new ApiError({ kind: "authorization", status: 403, message: "دسترسی ندارید." });
const unauthenticated = () => new ApiError({ kind: "authentication", status: 401, message: "نشست معتبر نیست." });
const missing = () => new ApiError({ kind: "not_found", status: 404, message: "یافت نشد." });
const serverError = () => new ApiError({ kind: "server", status: 500, message: "خطای سرور." });

type Loader = (params: { tenant?: string }, signal?: AbortSignal) => Promise<Page<Row>>;

function ListProbe({ label, loader }: { label: string; loader: Loader }) {
  const state = useResourceList<Row, { tenant?: string }>(loader, {});
  return (
    <div>
      <span data-testid={`${label}-items`}>{state.items.map((row) => row.id).join(",") || "-"}</span>
      <span data-testid={`${label}-error`}>{state.error?.kind ?? "-"}</span>
      <button data-testid={`${label}-reload`} onClick={state.reload}>reload</button>
    </div>
  );
}

function AuthListProbe({ loader }: { loader: Loader }) {
  const auth = useAuth();
  const state = useResourceList<Row, { tenant?: string }>(loader, {});
  return (
    <div>
      <span data-testid="auth-status">{auth.status}</span>
      <span data-testid="list-error">{state.error?.kind ?? "-"}</span>
      <span data-testid="list-items">{state.items.map((row) => row.id).join(",") || "-"}</span>
    </div>
  );
}

function SwitchingProbe({ loader }: { loader: Loader }) {
  const [tenant, setTenant] = useState("a");
  const state = useResourceList<Row, { tenant: string }>(loader, { tenant });
  return (
    <div>
      <span data-testid="switch-items">{state.items.map((row) => row.id).join(",") || "-"}</span>
      <span data-testid="switch-error">{state.error?.kind ?? "-"}</span>
      <button data-testid="switch" onClick={() => setTenant("b")}>switch</button>
    </div>
  );
}

function MediaProbe() {
  const { url, error } = useMediaObjectState("md_1");
  return (
    <div>
      <span data-testid="media-url">{url ?? "-"}</span>
      <span data-testid="media-error">{error?.kind ?? "-"}</span>
    </div>
  );
}

function TeacherMutationProbe() {
  const teachers = useTeachers({});
  return (
    <button
      data-testid="teacher-mutate"
      onClick={() => {
        void teachers.update("t1", { name: "Denied" }).catch(() => undefined);
      }}
    >
      mutate
    </button>
  );
}

function session(): Session {
  return {
    user: {
      id: "usr_teacher",
      name: "Teacher",
      email: "teacher@test.local",
      role: "teacher",
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    permissions: ["students.read"],
    token: "token-session",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
}

beforeEach(() => {
  resetRegistry();
  clearRolePolicies();
});

afterEach(() => {
  cleanup();
  resetRegistry();
  clearRolePolicies();
  vi.restoreAllMocks();
});

describe("resource-level 403 invalidation", () => {
  it("drops the denied page and leaves an unrelated cache intact", async () => {
    const protectedLoader = vi
      .fn<Loader>()
      .mockResolvedValueOnce(page(["secret"]))
      .mockRejectedValueOnce(denied());
    const publicLoader = vi.fn<Loader>(async () => page(["public"]));

    render(
      <>
        <ListProbe label="protected" loader={protectedLoader} />
        <ListProbe label="public" loader={publicLoader} />
      </>,
    );

    await waitFor(() => expect(screen.getByTestId("protected-items").textContent).toBe("secret"));
    expect(screen.getByTestId("public-items").textContent).toBe("public");

    fireEvent.click(screen.getByTestId("protected-reload"));

    await waitFor(() => expect(screen.getByTestId("protected-error").textContent).toBe("authorization"));
    expect(screen.getByTestId("protected-items").textContent).toBe("-");
    // The unrelated read was not invalidated by another domain's denial.
    expect(screen.getByTestId("public-items").textContent).toBe("public");
    expect(screen.getByTestId("public-error").textContent).toBe("-");
  });

  it("does not restore the page until a retry actually succeeds", async () => {
    const loader = vi
      .fn<Loader>()
      .mockRejectedValueOnce(denied())
      .mockRejectedValueOnce(denied())
      .mockResolvedValueOnce(page(["restored"]));

    render(<ListProbe label="retry" loader={loader} />);
    await waitFor(() => expect(screen.getByTestId("retry-error").textContent).toBe("authorization"));
    expect(screen.getByTestId("retry-items").textContent).toBe("-");

    fireEvent.click(screen.getByTestId("retry-reload"));
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("retry-error").textContent).toBe("authorization");
    expect(screen.getByTestId("retry-items").textContent).toBe("-");

    fireEvent.click(screen.getByTestId("retry-reload"));
    await waitFor(() => expect(screen.getByTestId("retry-items").textContent).toBe("restored"));
    expect(screen.getByTestId("retry-error").textContent).toBe("-");
  });

  it("keeps 401, 404, and 5xx distinct from a 403 denial", async () => {
    const seedThen = (failure: ApiError) =>
      vi.fn<Loader>().mockResolvedValueOnce(page(["row"])).mockRejectedValueOnce(failure);

    render(
      <>
        <ListProbe label="auth" loader={seedThen(unauthenticated())} />
        <ListProbe label="missing" loader={seedThen(missing())} />
        <ListProbe label="server" loader={seedThen(serverError())} />
      </>,
    );

    for (const label of ["auth", "missing", "server"]) {
      await waitFor(() => expect(screen.getByTestId(`${label}-items`).textContent).toBe("row"));
      fireEvent.click(screen.getByTestId(`${label}-reload`));
    }

    await waitFor(() => expect(screen.getByTestId("auth-error").textContent).toBe("authentication"));
    await waitFor(() => expect(screen.getByTestId("missing-error").textContent).toBe("not_found"));
    await waitFor(() => expect(screen.getByTestId("server-error").textContent).toBe("server"));

    // Only authorization is treated as proof that the data is no longer
    // accessible; the other failures keep their existing presentation.
    for (const label of ["auth", "missing", "server"]) {
      expect(screen.getByTestId(`${label}-items`).textContent).toBe("row");
    }
  });

  it("a late answer from a superseded query/tenant cannot repopulate the cache", async () => {
    let resolveOld!: (value: Page<Row>) => void;
    const loader = vi.fn<Loader>((params) => {
      if (params.tenant === "a") {
        return new Promise<Page<Row>>((resolve) => {
          resolveOld = resolve;
        });
      }
      return Promise.reject(denied());
    });

    render(<SwitchingProbe loader={loader} />);
    fireEvent.click(screen.getByTestId("switch"));

    await waitFor(() => expect(screen.getByTestId("switch-error").textContent).toBe("authorization"));
    expect(screen.getByTestId("switch-items").textContent).toBe("-");

    await act(async () => {
      resolveOld(page(["old-tenant"]));
      await Promise.resolve();
    });

    expect(screen.getByTestId("switch-items").textContent).toBe("-");
    expect(screen.getByTestId("switch-error").textContent).toBe("authorization");
  });

  it("does not log the session out on a resource-level 403", async () => {
    const current = session();
    const repo = {
      restore: vi.fn(async () => current),
      restoreDetailed: vi.fn(async () => ({ session: current, expiredReason: null })),
      login: vi.fn(),
      logout: vi.fn(async () => undefined),
      me: vi.fn(async () => current),
    } as unknown as AuthRepository;

    render(
      <AuthProvider repository={repo}>
        <AuthListProbe loader={vi.fn<Loader>(async () => Promise.reject(denied()))} />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("auth-status").textContent).toBe("authenticated"));
    await waitFor(() => expect(screen.getByTestId("list-error").textContent).toBe("authorization"));
    expect(screen.getByTestId("auth-status").textContent).toBe("authenticated");
    expect(screen.getByTestId("list-items").textContent).toBe("-");
    expect(repo.logout).not.toHaveBeenCalled();
  });

  it("does not change the role-policy lifecycle on a resource-level 403", async () => {
    beginRolePolicySession("token-role", true);
    commitRolePolicy(beginRolePolicyRequest("token-role")!, [defaultRoleRecord("teacher")]);
    expect(getRolePolicyState().status).toBe("fresh");

    render(<ListProbe label="role" loader={vi.fn<Loader>(async () => Promise.reject(denied()))} />);
    await waitFor(() => expect(screen.getByTestId("role-error").textContent).toBe("authorization"));

    expect(getRolePolicyState()).toMatchObject({
      status: "fresh",
      sessionKey: "token-role",
    });
  });

  it("does not automatically replay a denied mutation", async () => {
    const repo = {
      list: vi.fn(async () => emptyPage<Teacher>()),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(async () => {
        throw denied();
      }),
      delete: vi.fn(),
    } as unknown as TeacherRepository;
    setTeacherRepository(repo);

    render(<TeacherMutationProbe />);
    await waitFor(() => expect(repo.list).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByTestId("teacher-mutate"));
    await waitFor(() => expect(repo.update).toHaveBeenCalledTimes(1));

    await act(async () => {
      await Promise.resolve();
    });
    expect(repo.update).toHaveBeenCalledTimes(1);
    expect(repo.list).toHaveBeenCalledTimes(1);
  });
});

describe("media byte denial", () => {
  it("clears the object URL and exposes a 403 instead of a missing-file state", async () => {
    const media = {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      getBlob: vi.fn(async () => {
        throw denied();
      }),
    } as unknown as MediaRepository;
    setMediaRepository(media);

    render(<MediaProbe />);

    await waitFor(() => expect(screen.getByTestId("media-error").textContent).toBe("authorization"));
    expect(screen.getByTestId("media-url").textContent).toBe("-");
  });
});
