interface AccessTokenCache {
  accessToken: string;
  expiresAt: number;
}

const KV_KEY = "transak:access-token:v1";
const REFRESH_BEFORE_EXPIRY_SEC = 6 * 60 * 60;

function apiBase(env: CloudflareEnv): {
  partners: string;
  gateway: string;
} {
  const isProd = (env.TRANSAK_ENV ?? "STAGING").toUpperCase() === "PRODUCTION";
  return isProd
    ? {
        partners: "https://api.transak.com",
        gateway: "https://api-gateway.transak.com",
      }
    : {
        partners: "https://api-stg.transak.com",
        gateway: "https://api-gateway-stg.transak.com",
      };
}

async function refreshAccessToken(
  env: CloudflareEnv,
  apiKey: string,
  apiSecret: string,
): Promise<AccessTokenCache> {
  const { partners } = apiBase(env);
  const res = await fetch(`${partners}/partners/api/v2/refresh-token`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "api-secret": apiSecret,
    },
    body: JSON.stringify({ apiKey }),
  });
  if (!res.ok) {
    throw new Error(
      `transak refresh-token failed: ${res.status} ${await res.text()}`,
    );
  }
  const j = (await res.json()) as {
    data?: { accessToken?: string; expiresAt?: number };
  };
  if (!j.data?.accessToken || !j.data?.expiresAt) {
    throw new Error("transak refresh-token: missing token in response");
  }
  return { accessToken: j.data.accessToken, expiresAt: j.data.expiresAt };
}

async function getAccessToken(
  env: CloudflareEnv,
  apiKey: string,
  apiSecret: string,
): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const cached = (await env.KV.get(KV_KEY, "json")) as AccessTokenCache | null;
  if (cached && cached.expiresAt - nowSec > REFRESH_BEFORE_EXPIRY_SEC) {
    return cached.accessToken;
  }
  const fresh = await refreshAccessToken(env, apiKey, apiSecret);
  const ttl = Math.max(60, fresh.expiresAt - nowSec - 60);
  await env.KV.put(KV_KEY, JSON.stringify(fresh), { expirationTtl: ttl });
  return fresh.accessToken;
}

export interface CreateWidgetUrlArgs {
  asset: "sol" | "usdc";
  walletAddress: string;
  defaultCryptoAmount: number;
  partnerOrderId: string;
  referrerDomain: string;
}

export async function createTransakWidgetUrl(
  env: CloudflareEnv,
  args: CreateWidgetUrlArgs,
): Promise<string> {
  const apiKey = env.NEXT_PUBLIC_TRANSAK_API_KEY ?? env.TRANSAK_API_KEY;
  const apiSecret = env.TRANSAK_API_SECRET;
  if (!apiKey) throw new Error("TRANSAK API key not configured");
  if (!apiSecret) throw new Error("TRANSAK_API_SECRET not configured");

  const accessToken = await getAccessToken(env, apiKey, apiSecret);
  const { gateway } = apiBase(env);

  const isStaging = (env.TRANSAK_ENV ?? "STAGING").toUpperCase() !== "PRODUCTION";

  const widgetParams: Record<string, unknown> = {
    apiKey,
    referrerDomain: args.referrerDomain,
    productsAvailed: "BUY",
    cryptoCurrencyCode: args.asset === "sol" ? "SOL" : "USDC",
    network: "solana",
    walletAddress: args.walletAddress,
    defaultCryptoAmount: args.defaultCryptoAmount,
    partnerOrderId: args.partnerOrderId,
    disableWalletAddressForm: true,
    hideMenu: true,
    themeColor: "1f6b4e",
    paymentMethod: "credit_debit_card",
    defaultFiatCurrency: "EUR",
  };

  if (isStaging) {
    // Pre-fill the Transak EU staging test profile so the Lite-KYC step is
    // skipped during testing (anyone hitting staging gets the test data; this
    // branch is gated on TRANSAK_ENV !== PRODUCTION).
    widgetParams.userData = {
      firstName: "Doe",
      lastName: "Jane",
      mobileNumber: "+33791112345",
      dob: "1998-01-01",
      address: {
        addressLine1: "170 Rue du Faubourg",
        addressLine2: "Saint-Denis, Paris",
        city: "Paris",
        state: "Paris",
        postCode: "75010",
        countryCode: "FR",
      },
    };
  }

  const res = await fetch(`${gateway}/api/v2/auth/session`, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "access-token": accessToken,
    },
    body: JSON.stringify({ widgetParams }),
  });
  if (!res.ok) {
    throw new Error(
      `transak create-session failed: ${res.status} ${await res.text()}`,
    );
  }
  const j = (await res.json()) as { data?: { widgetUrl?: string } };
  if (!j.data?.widgetUrl) {
    throw new Error("transak create-session: missing widgetUrl");
  }
  return j.data.widgetUrl;
}
