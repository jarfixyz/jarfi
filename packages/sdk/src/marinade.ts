import { PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import type { TransactionInstruction, AccountMeta } from "@solana/web3.js";

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

export function createJarMsolAtaIx(
  payer: PublicKey,
  jar: PublicKey,
): TransactionInstruction {
  return createAssociatedTokenAccountInstruction(
    payer,
    jarMsolAta(jar),
    jar,
    MARINADE.msolMint,
  );
}

export function marinadeContributeSolRemaining(jar: PublicKey): AccountMeta[] {
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

export function marinadeUnstakeRemaining(jar: PublicKey): AccountMeta[] {
  return [
    { pubkey: MARINADE.program,      isSigner: false, isWritable: false },
    { pubkey: MARINADE.state,        isSigner: false, isWritable: true  },
    { pubkey: MARINADE.msolMint,     isSigner: false, isWritable: true  },
    { pubkey: MARINADE.liqSolLeg,    isSigner: false, isWritable: true  },
    { pubkey: MARINADE.liqMsolLeg,   isSigner: false, isWritable: true  },
    { pubkey: MARINADE.treasuryMsol, isSigner: false, isWritable: true  },
    { pubkey: jarMsolAta(jar),       isSigner: false, isWritable: true  },
    { pubkey: TOKEN_PROGRAM_ID,      isSigner: false, isWritable: false },
  ];
}
