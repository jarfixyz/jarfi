interface Options {
  fetcher?: typeof fetch;
  nowMs?: () => number;
}

interface BreakerState {
  open: boolean;
  consecutiveErrors: number;
}

const ERROR_THRESHOLD = 5;
const OPEN_DURATION_MS = 60_000;

export class CircuitBreakerRpc {
  private consecutiveErrors = 0;
  private openedAt: number | null = null;
  private readonly fetcher: typeof fetch;
  private readonly now: () => number;

  constructor(
    private readonly primaryUrl: string,
    private readonly fallbackUrl: string,
    opts: Options = {},
  ) {
    this.fetcher = opts.fetcher ?? fetch;
    this.now = opts.nowMs ?? (() => Date.now());
  }

  state(): BreakerState {
    return {
      open: this.openedAt !== null,
      consecutiveErrors: this.consecutiveErrors,
    };
  }

  async call<T = unknown>(method: string, params: unknown[]): Promise<T> {
    const useFallback =
      this.openedAt !== null &&
      this.now() - this.openedAt < OPEN_DURATION_MS;

    if (this.openedAt !== null && !useFallback) {
      this.openedAt = null;
      this.consecutiveErrors = 0;
    }

    const url = useFallback ? this.fallbackUrl : this.primaryUrl;

    const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
    const res = await this.fetcher(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });

    if (!res.ok) {
      if (!useFallback) {
        this.consecutiveErrors += 1;
        if (this.consecutiveErrors >= ERROR_THRESHOLD) {
          this.openedAt = this.now();
        }
      }
      throw new Error(`rpc ${method} failed: ${res.status}`);
    }

    if (!useFallback) {
      this.consecutiveErrors = 0;
    }
    const json = (await res.json()) as { result?: T; error?: { message: string } };
    if (json.error) throw new Error(json.error.message);
    return json.result as T;
  }
}

export function createRpc(env: {
  HELIUS_RPC: string;
  PUBLIC_RPC: string;
  HELIUS_API_KEY?: string;
}) {
  const heliusRpc = env.HELIUS_API_KEY
    ? env.HELIUS_RPC.replace("REPLACE_LOCAL_DEV", env.HELIUS_API_KEY)
    : env.PUBLIC_RPC;
  return new CircuitBreakerRpc(heliusRpc, env.PUBLIC_RPC);
}
