import {
  AnchorProvider,
  Program,
  BN,
} from "@coral-xyz/anchor";
import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  SystemProgram,
  type ConfirmOptions,
  type TransactionSignature,
} from "@solana/web3.js";

const RPC_OPTS: ConfirmOptions = {
  maxRetries: 0,
  skipPreflight: false,
  commitment: "confirmed",
  preflightCommitment: "confirmed",
};

function flattenErrorText(err: unknown, depth = 0): string {
  if (!err || depth > 4) return "";
  const out: string[] = [];
  if (typeof err === "string") return err;
  if (err instanceof Error) {
    out.push(err.message);
    if (err.stack) out.push(err.stack);
  }
  const anyErr = err as Record<string, unknown>;
  for (const key of ["cause", "error", "originalError", "innerError"]) {
    const nested = anyErr[key];
    if (nested) out.push(flattenErrorText(nested, depth + 1));
  }
  if (Array.isArray(anyErr.logs)) out.push((anyErr.logs as string[]).join("\n"));
  return out.join("\n");
}

async function swallowAlreadyProcessed(
  p: Promise<TransactionSignature>,
): Promise<TransactionSignature> {
  try {
    return await p;
  } catch (e) {
    if (/already been processed/i.test(flattenErrorText(e))) return "";
    throw e;
  }
}
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PROGRAM_ID } from "./constants";
import { idl, type Jarfi } from "./idl";
import {
  deriveConfigPda,
  deriveTreasuryPda,
  deriveUserStatePda,
  deriveJarPda,
  deriveContributionPda,
} from "./pdas";
import type { CreateJarParams, JarAccount } from "./types";
import {
  createJarMsolAtaIx,
  marinadeContributeSolRemaining,
  marinadeUnstakeRemaining,
} from "./marinade";

const READONLY_WALLET: AnchorProvider["wallet"] = {
  publicKey: PublicKey.default,
  signTransaction: async <T>(tx: T) => tx,
  signAllTransactions: async <T>(txs: T[]) => txs,
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function camelizeAccount<T>(value: unknown): T {
  if (Array.isArray(value)) {
    return value.map((v) => camelizeAccount(v)) as unknown as T;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[snakeToCamel(k)] = camelizeAccount(v);
    }
    return out as T;
  }
  return value as T;
}

export class JarfiClient {
  readonly program: Program<Jarfi>;
  readonly provider: AnchorProvider;
  readonly programId: PublicKey;

  constructor(
    connection: Connection,
    wallet: AnchorProvider["wallet"],
    programId: PublicKey = PROGRAM_ID,
  ) {
    this.provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    this.programId = programId;
    this.program = new Program<Jarfi>(idl as Jarfi, this.provider);
  }

  static readonly(
    connection: Connection,
    programId: PublicKey = PROGRAM_ID,
  ): JarfiClient {
    return new JarfiClient(connection, READONLY_WALLET, programId);
  }

  onJarChange(
    jar: PublicKey,
    cb: (info: { account: JarAccount; lamports: number } | null) => void,
  ): () => void {
    const sub = this.provider.connection.onAccountChange(
      jar,
      (info) => {
        if (!info || !info.data || info.data.length === 0) {
          cb(null);
          return;
        }
        try {
          const raw = this.program.coder.accounts.decode(
            "jar",
            info.data as Buffer,
          );
          cb({
            account: camelizeAccount<JarAccount>(raw),
            lamports: info.lamports,
          });
        } catch {
          cb(null);
        }
      },
      { commitment: "confirmed" },
    );
    return () => {
      void this.provider.connection.removeAccountChangeListener(sub);
    };
  }

  async initUserState(owner: PublicKey): Promise<TransactionSignature> {
    const [userState] = deriveUserStatePda(owner, this.programId);
    return swallowAlreadyProcessed(
      this.program.methods
        .initUserState()
        .accounts({
          owner,
          userState,
          systemProgram: SystemProgram.programId,
        } as never)
        .rpc(RPC_OPTS),
    );
  }

  async ensureUserState(owner: PublicKey): Promise<BN> {
    const [userState] = deriveUserStatePda(owner, this.programId);
    const info = await this.provider.connection.getAccountInfo(
      userState,
      "confirmed",
    );
    if (info) {
      return this.fetchUserJarCount(owner);
    }
    try {
      await this.initUserState(owner);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const alreadyExists =
        /already in use/i.test(msg) ||
        /custom program error: 0x0\b/i.test(msg) ||
        /already been processed/i.test(msg);
      if (!alreadyExists) throw err;
    }
    return this.fetchUserJarCount(owner);
  }

  async createJar(
    owner: PublicKey,
    id: BN,
    params: CreateJarParams,
    vaultMint?: PublicKey,
  ): Promise<TransactionSignature> {
    const enumJarType =
      params.jarType === "flexible" ? { flexible: {} } : { timeLocked: {} };
    const enumAsset = params.asset === "sol" ? { sol: {} } : { usdc: {} };

    const [userState] = deriveUserStatePda(owner, this.programId);
    const [jar] = deriveJarPda(owner, id, this.programId);
    const [config] = deriveConfigPda(this.programId);
    const [treasury] = deriveTreasuryPda(this.programId);

    const jarVault =
      params.asset === "usdc" && vaultMint
        ? PublicKey.findProgramAddressSync(
            [jar.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), vaultMint.toBuffer()],
            ASSOCIATED_TOKEN_PROGRAM_ID,
          )[0]
        : null;

    const autoStake = params.autoStake ?? false;
    const needsMsolAta = autoStake && params.asset === "sol";
    const builder = this.program.methods
      .createJar(
        enumJarType as never,
        enumAsset as never,
        params.goalAmount,
        params.unlockTimestamp,
        params.metadataUri,
        Array.from(params.metadataHash) as never,
        autoStake,
      )
      .accounts({
        owner,
        userState,
        jar,
        jarVault,
        vaultMint: vaultMint ?? null,
        config,
        treasury,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as never);
    if (needsMsolAta) {
      builder.preInstructions([createJarMsolAtaIx(owner, jar)]);
    }
    return swallowAlreadyProcessed(builder.rpc(RPC_OPTS));
  }

  async contributeSol(
    donor: PublicKey,
    jar: PublicKey,
    amountLamports: BN,
    opts?: { marinade?: boolean },
  ): Promise<TransactionSignature> {
    const [contribution] = deriveContributionPda(jar, donor, this.programId);
    const [config] = deriveConfigPda(this.programId);
    const builder = this.program.methods
      .contributeSol(amountLamports)
      .accounts({
        donor,
        jar,
        contribution,
        config,
        systemProgram: SystemProgram.programId,
      } as never);
    if (opts?.marinade) {
      builder.remainingAccounts(marinadeContributeSolRemaining(jar));
    }
    return swallowAlreadyProcessed(builder.rpc(RPC_OPTS));
  }

  async contributeSpl(
    donor: PublicKey,
    jar: PublicKey,
    donorTokenAccount: PublicKey,
    jarVault: PublicKey,
    amount: BN,
  ): Promise<TransactionSignature> {
    const [contribution] = deriveContributionPda(jar, donor, this.programId);
    const [config] = deriveConfigPda(this.programId);
    return swallowAlreadyProcessed(
      this.program.methods
        .contributeSpl(amount)
        .accounts({
          donor,
          jar,
          contribution,
          config,
          donorTokenAccount,
          jarVault,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as never)
        .rpc(RPC_OPTS),
    );
  }

  async withdraw(
    owner: PublicKey,
    jar: PublicKey,
    amount: BN | null = null,
    splAccounts?: {
      jarVault: PublicKey;
      ownerTokenAccount: PublicKey;
      treasuryTokenAccount: PublicKey;
      vaultMint: PublicKey;
    },
    opts?: { marinade?: boolean },
  ): Promise<TransactionSignature> {
    const [config] = deriveConfigPda(this.programId);
    const [treasury] = deriveTreasuryPda(this.programId);
    // Bump BPF heap to 256 KB. Anchor's account-validation macros allocate
    // through a bump allocator that never frees, so even modest structs
    // can exceed the 32 KB default during deserialization.
    const builder = this.program.methods
      .withdraw(amount)
      .accounts({
        owner,
        jar,
        config,
        treasury,
        jarVault: splAccounts?.jarVault ?? null,
        ownerTokenAccount: splAccounts?.ownerTokenAccount ?? null,
        treasuryTokenAccount: splAccounts?.treasuryTokenAccount ?? null,
        vaultMint: splAccounts?.vaultMint ?? null,
        tokenProgram: splAccounts ? TOKEN_PROGRAM_ID : null,
        systemProgram: SystemProgram.programId,
      } as never)
      .preInstructions([
        ComputeBudgetProgram.requestHeapFrame({ bytes: 256 * 1024 }),
      ]);
    if (opts?.marinade) {
      builder.remainingAccounts(marinadeUnstakeRemaining(jar));
    }
    return swallowAlreadyProcessed(builder.rpc(RPC_OPTS));
  }

  async cancelJar(
    owner: PublicKey,
    jar: PublicKey,
  ): Promise<TransactionSignature> {
    return swallowAlreadyProcessed(
      this.program.methods
        .cancelJar()
        .accounts({ owner, jar } as never)
        .rpc(RPC_OPTS),
    );
  }

  async refund(
    payer: PublicKey,
    jar: PublicKey,
    donor: PublicKey,
    opts?: { marinade?: boolean },
  ): Promise<TransactionSignature> {
    const [contribution] = deriveContributionPda(jar, donor, this.programId);
    const builder = this.program.methods
      .refund()
      .accounts({
        payer,
        jar,
        donor,
        contribution,
        systemProgram: SystemProgram.programId,
      } as never);
    if (opts?.marinade) {
      builder.remainingAccounts(marinadeUnstakeRemaining(jar));
    }
    return swallowAlreadyProcessed(builder.rpc(RPC_OPTS));
  }

  async closeJar(
    owner: PublicKey,
    jar: PublicKey,
  ): Promise<TransactionSignature> {
    return swallowAlreadyProcessed(
      this.program.methods
        .closeJar()
        .accounts({ owner, jar } as never)
        .rpc(RPC_OPTS),
    );
  }

  async updateMetadata(
    owner: PublicKey,
    jar: PublicKey,
    newUri: string,
    newHash: Uint8Array,
  ): Promise<TransactionSignature> {
    if (newHash.length !== 32) {
      throw new Error(`metadata hash must be 32 bytes, got ${newHash.length}`);
    }
    return swallowAlreadyProcessed(
      this.program.methods
        .updateMetadata(newUri, Array.from(newHash) as never)
        .accounts({ owner, jar } as never)
        .rpc(RPC_OPTS),
    );
  }

  async fetchJar(
    jar: PublicKey,
  ): Promise<{ account: JarAccount; lamports: number } | null> {
    const info = await this.provider.connection.getAccountInfo(
      jar,
      "confirmed",
    );
    if (!info) return null;
    try {
      const raw = this.program.coder.accounts.decode("jar", info.data);
      return {
        account: camelizeAccount<JarAccount>(raw),
        lamports: info.lamports,
      };
    } catch {
      return null;
    }
  }

  async fetchJarsByOwner(
    owner: PublicKey,
  ): Promise<{ pubkey: PublicKey; account: JarAccount }[]> {
    const filters = [
      { memcmp: { offset: 8 + 1, bytes: owner.toBase58() } },
    ];
    const raw = await this.provider.connection.getProgramAccounts(
      this.programId,
      { filters, commitment: "confirmed" },
    );
    const out: { pubkey: PublicKey; account: JarAccount }[] = [];
    for (const r of raw) {
      try {
        const decoded = this.program.coder.accounts.decode(
          "jar",
          r.account.data,
        );
        out.push({
          pubkey: r.pubkey,
          account: camelizeAccount<JarAccount>(decoded),
        });
      } catch {
        /* not a Jar account — discriminator mismatch, skip */
      }
    }
    return out;
  }

  async fetchUserJarCount(owner: PublicKey): Promise<BN> {
    const [userState] = deriveUserStatePda(owner, this.programId);
    const info = await this.provider.connection.getAccountInfo(
      userState,
      "confirmed",
    );
    if (!info) throw new Error("UserState not initialized");
    const raw = this.program.coder.accounts.decode("userState", info.data);
    const state = camelizeAccount<{ jarCount: BN }>(raw);
    return state.jarCount;
  }
}
