import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import {
  PROGRAM_ID,
  CONFIG_SEED,
  TREASURY_SEED,
  USER_STATE_SEED,
  JAR_SEED,
  CONTRIBUTION_SEED,
} from "./constants";

export function deriveConfigPda(programId: PublicKey = PROGRAM_ID) {
  return PublicKey.findProgramAddressSync([CONFIG_SEED], programId);
}

export function deriveTreasuryPda(programId: PublicKey = PROGRAM_ID) {
  return PublicKey.findProgramAddressSync([TREASURY_SEED], programId);
}

export function deriveUserStatePda(
  owner: PublicKey,
  programId: PublicKey = PROGRAM_ID,
) {
  return PublicKey.findProgramAddressSync(
    [USER_STATE_SEED, owner.toBuffer()],
    programId,
  );
}

export function deriveJarPda(
  owner: PublicKey,
  id: BN,
  programId: PublicKey = PROGRAM_ID,
) {
  return PublicKey.findProgramAddressSync(
    [JAR_SEED, owner.toBuffer(), id.toArrayLike(Buffer, "le", 8)],
    programId,
  );
}

export function deriveContributionPda(
  jar: PublicKey,
  donor: PublicKey,
  programId: PublicKey = PROGRAM_ID,
) {
  return PublicKey.findProgramAddressSync(
    [CONTRIBUTION_SEED, jar.toBuffer(), donor.toBuffer()],
    programId,
  );
}
