// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DemoDataManager } from "@/domains/demo/demoDataManager";
import { useDemoData } from "@/domains/demo/useDemoData";
import { DemoStoreImpl, memoryStorage } from "@/services/demoStore";

function Probe({ manager }: { manager: DemoDataManager }) {
  const demo = useDemoData(manager);
  return (
    <div>
      <span data-testid="total">{demo.stats.total}</span>
      <span data-testid="pending">{demo.pending?.action ?? "none"}</span>
      <button onClick={() => demo.request("clear")}>ask</button>
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

afterEach(cleanup);

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

  it("cancelling discards the pending destructive action", () => {
    const manager = setup();
    const before = manager.stats().total;
    fireEvent.click(screen.getByText("ask"));
    fireEvent.click(screen.getByText("cancel"));
    expect(screen.getByTestId("pending").textContent).toBe("none");
    expect(manager.stats().total).toBe(before);
  });

  it("confirming with nothing pending is a no-op", async () => {
    const manager = setup();
    const before = manager.stats().total;
    fireEvent.click(screen.getByText("confirm"));
    await waitFor(() => expect(manager.stats().total).toBe(before));
  });
});
