const { Marinade, MarinadeConfig } = require('@marinade.finance/marinade-ts-sdk')
const { PublicKey } = require('@solana/web3.js')

// mSOL mint — same on mainnet and devnet (Marinade uses same program)
const MSOL_MINT = new PublicKey('mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So')

// ---------------------------------------------------------------------------
// Stake SOL into Marinade, return mSOL lamports received
// ---------------------------------------------------------------------------
async function stakeWithMarinade(connection, keypair, lamports) {
  const config = new MarinadeConfig({
    connection,
    publicKey: keypair.publicKey,
  })
  const marinade = new Marinade(config)

  const { transaction } = await marinade.deposit(BigInt(lamports))

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  transaction.recentBlockhash = blockhash
  transaction.feePayer = keypair.publicKey
  transaction.sign(keypair)

  const signature = await connection.sendRawTransaction(transaction.serialize())
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight })

  // Read mSOL balance of server wallet after staking
  const { getAssociatedTokenAddress, getAccount } = require('@solana/spl-token')
  const msolAta = await getAssociatedTokenAddress(MSOL_MINT, keypair.publicKey)
  const msolAccount = await getAccount(connection, msolAta)

  return {
    signature,
    msol_lamports: Number(msolAccount.amount),
    msol_account: msolAta.toBase58(),
  }
}

// ---------------------------------------------------------------------------
// Unstake mSOL back to SOL (for withdrawal flow)
// ---------------------------------------------------------------------------
async function unstakeWithMarinade(connection, keypair, msolLamports) {
  const config = new MarinadeConfig({
    connection,
    publicKey: keypair.publicKey,
  })
  const marinade = new Marinade(config)

  const { transaction } = await marinade.liquidUnstake(BigInt(msolLamports))

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  transaction.recentBlockhash = blockhash
  transaction.feePayer = keypair.publicKey
  transaction.sign(keypair)

  const signature = await connection.sendRawTransaction(transaction.serialize())
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight })

  return { signature }
}

// ---------------------------------------------------------------------------
// Live APY — from Marinade public API
// ---------------------------------------------------------------------------
async function getLiveApy() {
  try {
    const res = await fetch('https://api.marinade.finance/msol/apy/1y')
    const data = await res.json()
    return data.value || 0.0685
  } catch {
    return 0.0685
  }
}

module.exports = { stakeWithMarinade, unstakeWithMarinade, getLiveApy, MSOL_MINT }
