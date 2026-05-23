import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Jarfi } from "../target/types/jarfi";

export const CONFIG_SEED = Buffer.from("config");
export const TREASURY_SEED = Buffer.from("treasury");
export const USER_STATE_SEED = Buffer.from("user");
export const JAR_SEED = Buffer.from("jar");
export const JAR_VAULT_SEED = Buffer.from("jar_vault");
export const CONTRIBUTION_SEED = Buffer.from("contrib");

export function deriveConfig(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([CONFIG_SEED], programId);
}

export function deriveTreasury(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([TREASURY_SEED], programId);
}

export function deriveUserState(
  owner: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [USER_STATE_SEED, owner.toBuffer()],
    programId
  );
}

export function deriveJar(
  owner: PublicKey,
  id: BN,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [JAR_SEED, owner.toBuffer(), id.toArrayLike(Buffer, "le", 8)],
    programId
  );
}

export function deriveJarVault(
  jar: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [JAR_VAULT_SEED, jar.toBuffer()],
    programId
  );
}

export function deriveContribution(
  jar: PublicKey,
  donor: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [CONTRIBUTION_SEED, jar.toBuffer(), donor.toBuffer()],
    programId
  );
}

export async function airdrop(
  provider: anchor.AnchorProvider,
  pubkey: PublicKey,
  sol: number
): Promise<void> {
  const sig = await provider.connection.requestAirdrop(
    pubkey,
    sol * LAMPORTS_PER_SOL
  );
  const latest = await provider.connection.getLatestBlockhash();
  await provider.connection.confirmTransaction({
    signature: sig,
    ...latest,
  });
}

export async function createFundedKeypair(
  provider: anchor.AnchorProvider,
  sol: number = 10
): Promise<Keypair> {
  const kp = Keypair.generate();
  await airdrop(provider, kp.publicKey, sol);
  return kp;
}

export async function createUsdcMint(
  provider: anchor.AnchorProvider,
  authority: Keypair
): Promise<PublicKey> {
  return createMint(
    provider.connection,
    authority,
    authority.publicKey,
    null,
    6 // USDC uses 6 decimals
  );
}

export async function mintUsdcTo(
  provider: anchor.AnchorProvider,
  mint: PublicKey,
  authority: Keypair,
  recipient: PublicKey,
  amount: bigint
): Promise<PublicKey> {
  const ata = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    authority,
    mint,
    recipient
  );
  await mintTo(
    provider.connection,
    authority,
    mint,
    ata.address,
    authority,
    amount
  );
  return ata.address;
}

export function solBalance(
  provider: anchor.AnchorProvider,
  pubkey: PublicKey
): Promise<number> {
  return provider.connection.getBalance(pubkey);
}

export async function expectRevert(
  promise: Promise<unknown>,
  errorCode: string
): Promise<void> {
  try {
    await promise;
    throw new Error(`Expected revert with ${errorCode}, but succeeded`);
  } catch (err: any) {
    const msg = err?.toString() ?? "";
    if (!msg.includes(errorCode)) {
      throw new Error(
        `Expected error containing "${errorCode}", got: ${msg}`
      );
    }
  }
}

export type JarfiProgram = Program<Jarfi>;

// ---------------------------------------------------------------------------
// Marinade Finance — pinned mainnet/devnet constants
// ---------------------------------------------------------------------------

export const MARINADE = {
  program:           new PublicKey("MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD"),
  state:             new PublicKey("8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC"),
  msolMint:          new PublicKey("mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So"),
  msolMintAuthority: new PublicKey("3JLPCS1qM2zRw3Dp6V4hZnYHd4toMNPkNesXdX9tg6KM"),
  reservePda:        new PublicKey("Du3Ysj1wKbxPKkuPPnvzQLQh8oMSVifs3jGZjJWXFmHN"),
  liqSolLeg:         new PublicKey("UefNb6z6yvArqe4cJHTXCqStRsKmWhGxnZzuHbikP5Q"),
  liqMsolLeg:        new PublicKey("7GgPYjS5Dza89wV6FpZ23kUJRG5vbQ1GM25ezspYFSoE"),
  liqMsolLegAuth:    new PublicKey("EyaSjUtSgo9aRD1f8LWXwdvkpDTmXAW54yoSHZRF14WL"),
  treasuryMsol:      new PublicKey("8ZUcztoAEhpAeC2ixWewJKQJsSUGYSGPVAjkhDJYf5Gd"),
};

export function jarMsolAta(jar: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(MARINADE.msolMint, jar, true);
}

export function marinadeContributeSolRemaining(jar: PublicKey) {
  return [
    { pubkey: MARINADE.program,           isSigner: false, isWritable: false },
    { pubkey: MARINADE.state,             isSigner: false, isWritable: true  },
    { pubkey: MARINADE.msolMint,          isSigner: false, isWritable: true  },
    { pubkey: MARINADE.liqSolLeg,         isSigner: false, isWritable: true  },
    { pubkey: MARINADE.liqMsolLeg,        isSigner: false, isWritable: true  },
    { pubkey: MARINADE.liqMsolLegAuth,    isSigner: false, isWritable: false },
    { pubkey: MARINADE.reservePda,        isSigner: false, isWritable: true  },
    { pubkey: MARINADE.msolMintAuthority, isSigner: false, isWritable: false },
    { pubkey: jarMsolAta(jar),            isSigner: false, isWritable: true  },
    { pubkey: TOKEN_PROGRAM_ID,           isSigner: false, isWritable: false },
  ];
}

export function marinadeUnstakeRemaining(jar: PublicKey) {
  return [
    { pubkey: MARINADE.program,         isSigner: false, isWritable: false },
    { pubkey: MARINADE.state,           isSigner: false, isWritable: true  },
    { pubkey: MARINADE.msolMint,        isSigner: false, isWritable: true  },
    { pubkey: MARINADE.liqSolLeg,       isSigner: false, isWritable: true  },
    { pubkey: MARINADE.liqMsolLeg,      isSigner: false, isWritable: true  },
    { pubkey: MARINADE.treasuryMsol,    isSigner: false, isWritable: true  },
    { pubkey: jarMsolAta(jar),          isSigner: false, isWritable: true  },
    { pubkey: TOKEN_PROGRAM_ID,         isSigner: false, isWritable: false },
  ];
}
