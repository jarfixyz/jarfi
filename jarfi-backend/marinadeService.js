const { Marinade, MarinadeConfig } = require('@marinade.finance/marinade-ts-sdk')
const { PublicKey } = require('@solana/web3.js')

const MSOL_MINT = new PublicKey('mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So')
const IS_MAINNET = process.env.SOLANA_NETWORK === 'mainnet'

// ---------------------------------------------------------------------------
// Stake SOL into Marinade, return mSOL lamports received
// On devnet: Marinade program is not deployed — log and return simulated result
// ---------------------------------------------------------------------------
async function stakeWithMarinade(connection, keypair, lamports) {
  if (!IS_MAINNET) {
    console.log(`[marinade] devnet — simulating stake of ${lamports} lamports (no real tx)`)
    return { signature: 'devnet-simulated', msol_lamports: lamports, msol_account: 'devnet-simulated' }
  }

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
// Unstake mSOL back to SOL
// On devnet: no-op
// ---------------------------------------------------------------------------
async function unstakeWithMarinade(connection, keypair, msolLamports) {
  if (!IS_MAINNET) {
    console.log(`[marinade] devnet — simulating unstake of ${msolLamports} mSOL lamports`)
    return { signature: 'devnet-simulated' }
  }

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
