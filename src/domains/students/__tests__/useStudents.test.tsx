// @vitest-environment jsdom
import { act } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/errors";
import { emptyPage } from "@/api/types";
import { DemoStudentRepository } from "@/domains/students/demoRepository";
import { useStudentList } from "@/domains/students/useStudents";
import type { StudentRepository } from "@/domains/students/repository";

function Probe({ repo }: { repo: StudentRepository }) {
  const { students, total, loading, error } = useStudentList({ status: "at-risk", per_page: 3 }, repo);
  if (loading) return <div>loading</div>;
  if (error) return <div>error:{error.kind}</div>;
  return <div>{`count:${students.length} total:${total}`}</div>;
}

afterEach(cleanup);

describe("useStudentList", () => {
  it("loads through the repository contract", async () => {
    const repo = new DemoStudentRepository();
    const expected = await repo.list({ status: "at-risk", per_page: 3 });
    render(<Probe repo={repo} />);
    await waitFor(() => expect(screen.getByText(`count:${expected.data.length} total:${expected.meta.total}`)).toBeTruthy());
  });

  it("surfaces normalized errors", async () => {
    const failing: StudentRepository = {
      list: vi.fn(async () => {
        throw new ApiError({ kind: "server", message: "down" });
      }),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as unknown as StudentRepository;
    render(<Probe repo={failing} />);
    await waitFor(() => expect(screen.getByText("error:server")).toBeTruthy());
  });

  it("ignores cancelled requests", async () => {
    const repo: StudentRepository = {
      list: vi.fn(async () => emptyPage()),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as unknown as StudentRepository;
    const view = render(<Probe repo={repo} />);
    await act(async () => {
      view.unmount();
    });
    expect(repo.list).toHaveBeenCalledTimes(1);
  });
});
