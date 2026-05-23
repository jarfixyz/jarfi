import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  "GBqqB8ZfNDPRyUZczbUxkmU3UopQ1BFMPu4sXGd115yF",
);

export const CONFIG_SEED = Buffer.from("config");
export const TREASURY_SEED = Buffer.from("treasury");
export const USER_STATE_SEED = Buffer.from("user");
export const JAR_SEED = Buffer.from("jar");
export const CONTRIBUTION_SEED = Buffer.from("contrib");

export const MAX_WITHDRAW_FEE_BPS = 500;
export const MAX_CREATION_FEE_LAMPORTS = 100_000_000;
export const MAX_METADATA_URI_LEN = 200;
export const BPS_DENOMINATOR = 10_000;

export const JAR_ACCOUNT_SIZE = 325;
export const JAR_RENT_LAMPORTS = 3_152_880;
