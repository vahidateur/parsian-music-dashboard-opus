// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LibraryAudioPlayer } from "../LibraryAudioPlayer";
import type { LibraryItem } from "@/domains/library/types";

const item: LibraryItem = {
  id: "resource-audio-test",
  title: "اتود شنیداری",
  composer: "مدرس پارسیان",
  kind: "audio",
  instrument: "piano",
  level: "میانی",
  size: "نامشخص",
  added: "امروز",
  uses: 2,
};

afterEach(cleanup);

describe("LibraryAudioPlayer room controls", () => {
  it("exposes previous, next and dismiss actions without native browser controls", () => {
    const previous = vi.fn();
    const next = vi.fn();
    const close = vi.fn();

    render(
      <LibraryAudioPlayer
        item={item}
        expanded={false}
        onToggleExpanded={vi.fn()}
        onPrevious={previous}
        onNext={next}
        onClose={close}
      />,
    );

    expect(screen.queryByRole("button", { name: "قطعهٔ قبلی" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "قطعهٔ بعدی" })).not.toBeNull();
    expect(screen.queryByRole("audio")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "قطعهٔ قبلی" }));
    fireEvent.click(screen.getByRole("button", { name: "قطعهٔ بعدی" }));
    fireEvent.click(screen.getByRole("button", { name: "بستن پخش‌کننده" }));

    expect(previous).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
});
