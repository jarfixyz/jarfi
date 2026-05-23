import {
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";

export interface SimpleWallet {
  publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(
    txs: T[],
  ): Promise<T[]>;
  payer: Keypair;
}

export function makeKeypairWallet(kp: Keypair): SimpleWallet {
  return {
    publicKey: kp.publicKey,
    payer: kp,
    async signTransaction<T extends Transaction | VersionedTransaction>(tx: T) {
      if (tx instanceof Transaction) {
        tx.partialSign(kp);
      } else {
        tx.sign([kp]);
      }
      return tx;
    },
    async signAllTransactions<T extends Transaction | VersionedTransaction>(
      txs: T[],
    ) {
      for (const tx of txs) {
        if (tx instanceof Transaction) {
          tx.partialSign(kp);
        } else {
          tx.sign([kp]);
        }
      }
      return txs;
    },
  };
}
