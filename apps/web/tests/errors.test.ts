// @vitest-environment node
import { describe, it, expect } from "vitest";
import { classifyError } from "@/lib/errors";

describe("classifyError", () => {
  it("detects wallet rejection", () => {
    const err = { message: "User rejected the request." };
    expect(classifyError(err).kind).toBe("user_rejected");
  });

  it("extracts Anchor error message", () => {
    const err = {
      error: {
        errorCode: { code: "GoalTooSmall" },
        errorMessage: "Goal must be >= min",
      },
    };
    const out = classifyError(err);
    expect(out.kind).toBe("program");
    expect(out.message).toContain("Goal must be >= min");
  });

  it("detects network errors", () => {
    const err = new Error("failed to fetch");
    expect(classifyError(err).kind).toBe("network");
  });

  it("falls back to unknown", () => {
    expect(classifyError(new Error("boom")).kind).toBe("unknown");
  });
});
