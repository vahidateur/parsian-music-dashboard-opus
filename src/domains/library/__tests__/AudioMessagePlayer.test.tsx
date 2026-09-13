// @vitest-environment jsdom
/**
 * Audio player behaviour.
 *
 * jsdom implements no media pipeline, so `play()` and `currentTime` are stubbed
 * on the prototype. What is genuinely under test is everything around the
 * codec: control state, accessible semantics, RTL keyboard seeking, the
 * no-decode waveform strategy, and honest error reporting.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioMessagePlayer } from "../AudioMessagePlayer";

afterEach(cleanup);

let playSpy: ReturnType<typeof vi.fn>;
let pauseSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  playSpy = vi.fn().mockResolvedValue(undefined);
  pauseSpy = vi.fn();
  Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: playSpy });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: pauseSpy });

  // jsdom leaves `paused` permanently true; drive it from the spies instead.
  let paused = true;
  Object.defineProperty(HTMLMediaElement.prototype, "paused", {
    configurable: true,
    get: () => paused,
  });
  playSpy.mockImplementation(async () => {
    paused = false;
  });
  pauseSpy.mockImplementation(() => {
    paused = true;
  });

  let currentTime = 0;
  Object.defineProperty(HTMLMediaElement.prototype, "currentTime", {
    configurable: true,
    get: () => currentTime,
    set: (value: number) => {
      currentTime = value;
    },
  });
});

function renderPlayer(props: Partial<React.ComponentProps<typeof AudioMessagePlayer>> = {}) {
  return render(
    <AudioMessagePlayer src="blob:demo-audio" seed="res1" title="تمرین شمارهٔ ۱" durationSeconds={60} {...props} />,
  );
}

describe("playback controls", () => {
  it("starts and stops playback through one labelled button", async () => {
    renderPlayer();
    const button = screen.getByRole("button", { name: /پخش تمرین/ });
    expect(button).toHaveProperty("ariaPressed", "false");

    fireEvent.click(button);
    expect(playSpy).toHaveBeenCalledTimes(1);
    const stop = await screen.findByRole("button", { name: /توقف تمرین/ });
    expect(stop).toHaveProperty("ariaPressed", "true");

    fireEvent.click(stop);
    expect(pauseSpy).toHaveBeenCalledTimes(1);
  });

  it("reports a playback failure instead of silently doing nothing", async () => {
    playSpy.mockRejectedValueOnce(new Error("NotAllowedError"));
    renderPlayer();
    fireEvent.click(screen.getByRole("button", { name: /پخش/ }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "NotAllowedError");
  });

  it("disables itself and states the reason when audio is unavailable", () => {
    renderPlayer({ src: undefined, unavailableReason: "فایل صوتی در دمو بارگذاری نشده است." });
    expect((screen.getByRole("button", { name: /پخش/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain("بارگذاری نشده");
  });
});

describe("accessible seek slider", () => {
  it("exposes a slider with a Persian time readout", () => {
    renderPlayer();
    const slider = screen.getByRole("slider", { name: /جایگاه پخش/ });
    expect(slider.getAttribute("aria-valuemin")).toBe("0");
    expect(slider.getAttribute("aria-valuemax")).toBe("100");
    expect(slider.getAttribute("aria-valuetext")).toMatch(/از/);
  });

  it("seeks forward with ArrowLeft, because the layout is RTL", () => {
    const { container } = renderPlayer();
    const audio = container.querySelector("audio") as HTMLAudioElement;
    fireEvent.loadedMetadata(audio);

    const slider = screen.getByRole("slider", { name: /جایگاه پخش/ });
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    // 5s step on a 60s track.
    expect(audio.currentTime).toBeCloseTo(5, 1);

    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(audio.currentTime).toBeCloseTo(0, 1);
  });

  it("jumps to the start and end with Home and End", () => {
    const { container } = renderPlayer();
    const audio = container.querySelector("audio") as HTMLAudioElement;
    const slider = screen.getByRole("slider", { name: /جایگاه پخش/ });

    fireEvent.keyDown(slider, { key: "End" });
    expect(audio.currentTime).toBeCloseTo(60, 1);
    fireEvent.keyDown(slider, { key: "Home" });
    expect(audio.currentTime).toBeCloseTo(0, 1);
  });

  it("never seeks past the track bounds", () => {
    const { container } = renderPlayer();
    const audio = container.querySelector("audio") as HTMLAudioElement;
    const slider = screen.getByRole("slider", { name: /جایگاه پخش/ });

    for (let i = 0; i < 40; i += 1) fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(audio.currentTime).toBeLessThanOrEqual(60);
    for (let i = 0; i < 40; i += 1) fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(audio.currentTime).toBeGreaterThanOrEqual(0);
  });

  it("is not focusable while disabled", () => {
    renderPlayer({ src: undefined, unavailableReason: "ناموجود" });
    expect(screen.getByRole("slider").getAttribute("tabindex")).toBe("-1");
  });
});

describe("waveform rendering strategy", () => {
  it("renders a fixed bar count without decoding audio", () => {
    const { container } = renderPlayer();
    // 48 bars regardless of input; no AudioContext is constructed anywhere.
    expect(container.querySelectorAll("[role=slider] > span")).toHaveLength(48);
  });

  it("resamples supplied peaks onto the same bar count", () => {
    const { container } = renderPlayer({ peaks: Array.from({ length: 300 }, (_, i) => (i % 10) / 10) });
    expect(container.querySelectorAll("[role=slider] > span")).toHaveLength(48);
  });

  it("derives a stable placeholder shape from the seed", () => {
    const first = render(<AudioMessagePlayer src="blob:a" seed="same-seed" title="الف" />);
    const heightsA = [...first.container.querySelectorAll("[role=slider] > span")].map(
      (el) => (el as HTMLElement).style.height,
    );
    cleanup();

    const second = render(<AudioMessagePlayer src="blob:b" seed="same-seed" title="ب" />);
    const heightsB = [...second.container.querySelectorAll("[role=slider] > span")].map(
      (el) => (el as HTMLElement).style.height,
    );
    expect(heightsA).toEqual(heightsB);
  });

  it("gives different seeds different shapes", () => {
    const first = render(<AudioMessagePlayer src="blob:a" seed="seed-one" title="الف" />);
    const heightsA = [...first.container.querySelectorAll("[role=slider] > span")].map(
      (el) => (el as HTMLElement).style.height,
    );
    cleanup();

    const second = render(<AudioMessagePlayer src="blob:b" seed="seed-two" title="ب" />);
    const heightsB = [...second.container.querySelectorAll("[role=slider] > span")].map(
      (el) => (el as HTMLElement).style.height,
    );
    expect(heightsA).not.toEqual(heightsB);
  });
});
