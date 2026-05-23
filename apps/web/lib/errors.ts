type ErrorKind =
  | "user_rejected"
  | "already_processed"
  | "program"
  | "network"
  | "unknown";

interface ClassifiedError {
  kind: ErrorKind;
  message: string;
}

function textOf(err: unknown, depth = 0): string {
  if (!err || depth > 4) return "";
  if (typeof err === "string") return err;
  const parts: string[] = [];
  if (err instanceof Error) parts.push(err.message);
  const anyErr = err as {
    message?: string;
    cause?: unknown;
    error?: unknown;
    originalError?: unknown;
    innerError?: unknown;
    logs?: string[];
  };
  if (typeof anyErr.message === "string" && !parts.length) {
    parts.push(anyErr.message);
  }
  for (const key of ["cause", "error", "originalError", "innerError"] as const) {
    if (anyErr[key]) parts.push(textOf(anyErr[key], depth + 1));
  }
  if (Array.isArray(anyErr.logs)) parts.push(anyErr.logs.join("\n"));
  return parts.join("\n");
}

export function classifyError(err: unknown): ClassifiedError {
  const raw = textOf(err);
  const msg = raw.toLowerCase();

  if (
    msg.includes("user rejected") ||
    msg.includes("rejected the request") ||
    msg.includes("request rejected")
  ) {
    return {
      kind: "user_rejected",
      message: "Cancelled — try again when you're ready.",
    };
  }

  if (msg.includes("already been processed")) {
    return {
      kind: "already_processed",
      message: "Transaction already submitted.",
    };
  }

  const anchor = (
    err as {
      error?: {
        errorCode?: { code?: string };
        errorMessage?: string;
      };
    }
  ).error;
  if (anchor?.errorMessage) {
    return { kind: "program", message: anchor.errorMessage };
  }

  if (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("econnrefused") ||
    msg.includes("timeout")
  ) {
    return {
      kind: "network",
      message: "Network issue. Check your connection and retry.",
    };
  }

  return { kind: "unknown", message: raw || "Something went wrong." };
}
