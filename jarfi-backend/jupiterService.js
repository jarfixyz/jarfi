const { VersionedTransaction, PublicKey } = require('@solana/web3.js')

const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6'
const WSOL_MINT = 'So11111111111111111111111111111111111111112'
const USDC_MINT_DEVNET  = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
const USDC_MINT_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

function usdcMintStr() {
  return process.env.SOLANA_NETWORK === 'mainnet' ? USDC_MINT_MAINNET : USDC_MINT_DEVNET
}

// ---------------------------------------------------------------------------
// Get Jupiter quote: USDC micro-units → SOL lamports
// Returns the full quoteResponse object
// ---------------------------------------------------------------------------
async function getUsdcToSolQuote(usdcMicroUnits, slippageBps = 50) {
  const params = new URLSearchParams({
    inputMint:   usdcMintStr(),
    outputMint:  WSOL_MINT,
    amount:      String(usdcMicroUnits),
    slippageBps: String(slippageBps),
  })
  const res = await fetch(`${JUPITER_QUOTE_API}/quote?${params}`)
  if (!res.ok) throw new Error(`Jupiter quote failed: ${res.status} ${await res.text()}`)
  return res.json()
}

// ---------------------------------------------------------------------------
// Swap USDC → SOL using Jupiter V6
// Returns { signature, outLamports }
// ---------------------------------------------------------------------------
async function swapUsdcToSol(connection, keypair, usdcMicroUnits) {
  // 1. Get quote
  const quoteResponse = await getUsdcToSolQuote(usdcMicroUnits)
  const outLamports = Number(quoteResponse.outAmount)
  console.log(`[jupiter] quote: ${usdcMicroUnits} USDC micro → ${outLamports} lamports SOL`)

  // 2. Get swap transaction
  const swapRes = await fetch(`${JUPITER_QUOTE_API}/swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey:     keypair.publicKey.toBase58(),
      wrapAndUnwrapSol:  true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto',
    }),
  })
  if (!swapRes.ok) throw new Error(`Jupiter swap failed: ${swapRes.status} ${await swapRes.text()}`)
  const { swapTransaction } = await swapRes.json()

  // 3. Deserialize versioned transaction, sign, send
  const txBuf = Buffer.from(swapTransaction, 'base64')
  const tx = VersionedTransaction.deserialize(txBuf)
  tx.sign([keypair])

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  })
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight })

  console.log(`[jupiter] swap confirmed: ${signature}`)
  return { signature, outLamports }
}

module.exports = { swapUsdcToSol, getUsdcToSolQuote }
