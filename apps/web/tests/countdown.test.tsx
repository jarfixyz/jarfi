import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CountdownTimer } from "@/components/ui/countdown";

describe("CountdownTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers().setSystemTime(new Date("2026-04-14T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders dhms when target is in the future", () => {
    const target = new Date("2026-04-16T03:04:05Z");
    render(<CountdownTimer target={target} />);
    const node = screen.getByRole("timer");
    expect(node.textContent).toContain("2d");
    expect(node.textContent).toContain("03h");
    expect(node.textContent).toContain("04m");
  });

  it("renders 'unlocked' when target has passed", () => {
    const target = new Date("2026-04-13T00:00:00Z");
    render(<CountdownTimer target={target} />);
    expect(screen.getByText(/unlocked/i)).toBeInTheDocument();
  });
});
