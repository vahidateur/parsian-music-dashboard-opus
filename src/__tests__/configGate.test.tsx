// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { resetRuntimeConfig, setRuntimeConfig } from "@/api/config";
import App from "@/App";
afterEach(() => { resetRuntimeConfig(); cleanup(); });
describe("ConfigGate", () => {
  it("blocks the whole app on a config error", () => {
    setRuntimeConfig({ mode: "demo", error: "VITE_DATA_SOURCE=\"prodution\" is not valid" });
    render(<App />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("پیکربندی محیط نامعتبر است")).toBeTruthy();
    // No login form, no shell.
    expect(screen.queryByText(/ورود/)).toBeNull();
  });
  it("renders the app normally when config is valid", () => {
    setRuntimeConfig({ mode: "demo", error: null });
    render(<App />);
    expect(screen.queryByText("پیکربندی محیط نامعتبر است")).toBeNull();
  });
});
