// @vitest-environment jsdom
/**
 * A failed levels read is not a program with zero levels.
 *
 * The heading is allowed to withhold its count while the read is in flight, but
 * it used to print «۰ سطح» as soon as the read failed — beside the ErrorState
 * that said the read failed. These cases keep the failure, the legitimate empty
 * answer and the successful count distinguishable.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { AppProvider } from "@/context/AppContext";
import type { Page } from "@/api/types";
import { getLearningRepository, resetRegistry, setLearningRepository } from "@/domains/registry";
import type { LearningLevel } from "../types";
import { LearningPanel } from "../LearningPanel";
import { faNum } from "@/lib/format";
import { withStubs } from "@/test/repositoryStubs";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

afterEach(cleanup);
beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
});

function renderPanel() {
  return render(
    <AppProvider>
      <LearningPanel />
    </AppProvider>,
  );
}

function levelsHeading(): HTMLElement {
  return screen.getByText(/سطوح «/);
}

function stubLevels(listLevels: (params?: unknown, signal?: AbortSignal) => Promise<Page<LearningLevel>>) {
  setLearningRepository(withStubs(getLearningRepository(), { listLevels: listLevels as never }));
}

describe("the levels heading and a failed read", () => {
  it("renders the ErrorState and withholds the count when the levels read fails", async () => {
    stubLevels(async () => {
      throw new ApiError({ kind: "network", message: "سطوح در دسترس نیست." });
    });
    renderPanel();

    expect(await screen.findByText("بارگذاری سطوح ناموفق بود")).toBeTruthy();
    expect(levelsHeading().textContent).not.toContain("۰ سطح");
    expect(screen.queryByText("این دوره هنوز سطحی ندارد")).toBeNull();
  });

  it("keeps a successful empty result distinguishable from a failure", async () => {
    stubLevels(async () => ({ data: [], meta: { page: 1, per_page: 200, total: 0 } }));
    renderPanel();

    expect(await screen.findByText("این دوره هنوز سطحی ندارد")).toBeTruthy();
    expect(levelsHeading().textContent).toContain("۰ سطح");
    expect(screen.queryByText("بارگذاری سطوح ناموفق بود")).toBeNull();
  });

  it("still shows the correct count for a successful non-empty result", async () => {
    const repository = getLearningRepository();
    const programs = (await repository.listPrograms({ per_page: 200 })).data;
    const levels = (await repository.listLevels({ programId: programs[0].id, per_page: 200 })).data;
    expect(levels.length).toBeGreaterThan(0);

    renderPanel();

    await waitFor(() => expect(levelsHeading().textContent).toContain(`${faNum(levels.length)} سطح`));
    expect(screen.queryByText("بارگذاری سطوح ناموفق بود")).toBeNull();
  });
});
