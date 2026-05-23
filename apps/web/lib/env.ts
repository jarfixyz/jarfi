export {};

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    METADATA_BUCKET: R2Bucket;
    KV: KVNamespace;
    ASSETS?: Fetcher;
    HELIUS_RPC: string;
    PUBLIC_RPC: string;
    PROGRAM_ID: string;
    CRON_SECRET: string;
    HELIUS_API_KEY?: string;
    NEXT_PUBLIC_TRANSAK_API_KEY?: string;
    TRANSAK_API_KEY?: string;
    TRANSAK_API_SECRET?: string;
    TRANSAK_ENV?: string;
    TRANSAK_WEBHOOK_SECRET?: string;
    RELAY_TREASURY_SECRET?: string;
    RELAY_ENC_KEY?: string;
  }
}
