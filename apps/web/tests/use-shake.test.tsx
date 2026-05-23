import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useSignatureShake } from "@/lib/design/use-shake";

describe("useSignatureShake", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("toggles shaking for the configured duration", () => {
    const { result } = renderHook(() => useSignatureShake(400));
    expect(result.current.shaking).toBe(false);
    act(() => result.current.trigger());
    expect(result.current.shaking).toBe(true);
    act(() => {
      vi.advanceTimersByTime(450);
    });
    expect(result.current.shaking).toBe(false);
  });

  it("resets the timer when triggered mid-shake", () => {
    const { result } = renderHook(() => useSignatureShake(400));
    act(() => result.current.trigger());
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => result.current.trigger());
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.shaking).toBe(true);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.shaking).toBe(false);
  });
});
