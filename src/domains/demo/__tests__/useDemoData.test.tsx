// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMemoryBlobStore, setBlobStore } from "@/domains/media/blobStore";
import { DemoDataManager } from "@/domains/demo/demoDataManager";
import { useDemoData } from "@/domains/demo/useDemoData";
import { DemoStoreImpl, memoryStorage } from "@/services/demoStore";

function Probe({ manager }: { manager: DemoDataManager }) {
  const demo = useDemoData(manager);
  return (
    <div>
      <span data-testid="total">{demo.stats.total}</span>
      <span data-testid="pending">{demo.pending?.action ?? "none"}</span>
      <span data-testid="busy">{demo.busy ? "true" : "false"}</span>
      <span data-testid="result">{demo.lastResult?.operation ?? "none"}</span>
      <span data-testid="message">{demo.lastResult?.message ?? ""}</span>
      <button onClick={() => demo.request("clear")}>ask</button>
      <button onClick={() => demo.request("uninitialize")}>uninitialize</button>
      <button onClick={() => void demo.confirm()}>confirm</button>
      <button onClick={demo.cancel}>cancel</button>
    </div>
  );
}

function setup() {
  const manager = new DemoDataManager(new DemoStoreImpl(memoryStorage()));
  manager.initialize();
  render(<Probe manager={manager} />);
  return manager;
}

beforeEach(() => setBlobStore(createMemoryBlobStore()));
afterEach(() => {
  cleanup();
  setBlobStore(undefined);
});

describe("useDemoData confirmation flow", () => {
  it("does not mutate data until the pending action is confirmed", async () => {
    const manager = setup();
    const before = manager.stats().total;
    fireEvent.click(screen.getByText("ask"));
    expect(screen.getByTestId("pending").textContent).toBe("clear");
    expect(manager.stats().total).toBe(before);

    fireEvent.click(screen.getByText("confirm"));
    await waitFor(() => expect(manager.stats().total).toBe(0));
    await waitFor(() => expect(screen.getByTestId("pending").textContent).toBe("none"));
  });

  it("cancelling discards an uninitialize request and leaves the environment unchanged", () => {
    const manager = setup();
    const before = manager.stats().total;
    fireEvent.click(screen.getByText("uninitialize"));
    fireEvent.click(screen.getByText("cancel"));

    expect(screen.getByTestId("pending").textContent).toBe("none");
    expect(manager.stats().total).toBe(before);
    expect(manager.lifecycleState()).toBe("demo");
  });

  it("awaits uninitialize and preserves the awaited lifecycle result", async () => {
    let releaseClear: () => void = () => undefined;
    const clearFinished = new Promise<void>((resolve) => {
      releaseClear = resolve;
    });
    const blobStore = createMemoryBlobStore();
    blobStore.clear = () => clearFinished;
    setBlobStore(blobStore);

    const manager = setup();
    fireEvent.click(screen.getByText("uninitialize"));
    fireEvent.click(screen.getByText("confirm"));

    await waitFor(() => expect(screen.getByTestId("busy").textContent).toBe("true"));
    expect(screen.getByTestId("pending").textContent).toBe("uninitialize");
    expect(manager.lifecycleState()).toBe("uninitialized");
    expect(manager.stats().total).toBe(0);

    releaseClear();

    await waitFor(() => {
      expect(screen.getByTestId("busy").textContent).toBe("false");
      expect(screen.getByTestId("pending").textContent).toBe("none");
      expect(screen.getByTestId("result").textContent).toBe("uninitialize");
    });
    expect(screen.getByTestId("total").textContent).toBe("0");
    expect(screen.getByTestId("message").textContent).toBe("محیط حذف شد و هیچ داده‌ای باقی نمانده است.");
  });

  it("confirming with nothing pending is a no-op", async () => {
    const manager = setup();
    const before = manager.stats().total;
    fireEvent.click(screen.getByText("confirm"));
    await waitFor(() => expect(manager.stats().total).toBe(before));
  });
});
