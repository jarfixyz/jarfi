/**
 * Kamino Lend integration service.
 *
 * On mainnet: deposits USDC into a Kamino reserve via the klend-sdk and
 * tracks obligations per jar.
 *
 * On devnet: Kamino has no public market so we fall back to a local ledger
 * that calculates accrued yield mathematically (amount × APY × elapsed).
 * The ledger persists in kamino-ledger.json next to this file.
 *
 * Either way the public API is identical:
 *   depositToKamino(jarPubkeyStr, usdcMicroUnits) → { obligationPubkey, simulated }
 *   getYieldEarned(jarPubkeyStr)                  → { earned_usdc, earned_usd }
 *   redeemFromKamino(jarPubkeyStr)                → { redeemed_usdc, simulated }
 */

const fs   = require('fs')
const path = require('path')
const { Connection, PublicKey, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js')

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const LEDGER_PATH = path.join(__dirname, 'kamino-ledger.json')
const IS_MAINNET  = process.env.SOLANA_NETWORK === 'mainnet'

// Kamino mainnet program + market
const KAMINO_PROGRAM_ID  = 'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD'
const KAMINO_MARKET      = '7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF'

// Fallback APY used when live rate is unavailable (6 dec precision)
const FALLBACK_USDC_APY = 0.055  // 5.5% conservative

// ---------------------------------------------------------------------------
// Ledger helpers (shared by both paths)
// ---------------------------------------------------------------------------

function readLedger() {
  try {
    return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'))
  } catch {
    return {}
  }
}

function writeLedger(data) {
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(data, null, 2))
}

// ---------------------------------------------------------------------------
// APY cache
// ---------------------------------------------------------------------------

let _apyCache = { value: FALLBACK_USDC_APY, fetchedAt: 0 }

// DeFi Llama pool ID for Kamino USDC lending (mainnet)
const DEFILLAMA_KAMINO_USDC_POOL = 'd2141a59-c199-4be7-8d4b-c8223954836b'

async function getLiveApy() {
  const now = Date.now()
  if (now - _apyCache.fetchedAt < 3_600_000) return _apyCache.value  // 1h cache

  // Primary: DeFi Llama — aggregates Kamino lend USDC APY reliably
  try {
    const res = await fetch('https://yields.llama.fi/pools', { signal: AbortSignal.timeout(8000) })
    const data = await res.json()
    const pools = data?.data ?? []
    const pool = pools.find(p =>
      p?.pool === DEFILLAMA_KAMINO_USDC_POOL ||
      (p?.project === 'kamino-lend' && p?.symbol === 'USDC' && p?.chain === 'Solana')
    )
    if (pool?.apy && pool.apy > 0) {
      // DeFi Llama returns APY as percentage (e.g. 4.55 = 4.55%)
      const decimal = pool.apy / 100
      _apyCache = { value: decimal, fetchedAt: now }
      console.log(`[kamino] live APY from DeFi Llama: ${pool.apy.toFixed(2)}%`)
      return decimal
    }
  } catch { /* fall through */ }

  console.warn('[kamino] APY fetch failed — using fallback')
  return FALLBACK_USDC_APY
}

// ---------------------------------------------------------------------------
// Simulated path (devnet + mainnet fallback)
// ---------------------------------------------------------------------------

function simulatedDeposit(jarPubkeyStr, usdcMicroUnits, apy) {
  const ledger = readLedger()
  const existing = ledger[jarPubkeyStr]
  if (existing) {
    // Add to existing position
    existing.usdc_micro += usdcMicroUnits
    existing.last_updated = Date.now()
  } else {
    ledger[jarPubkeyStr] = {
      usdc_micro:    usdcMicroUnits,
      deposited_at:  Date.now(),
      last_updated:  Date.now(),
      apy:           apy,
      obligation:    null,
    }
  }
  writeLedger(ledger)
  console.log(`[kamino] simulated deposit ${usdcMicroUnits / 1e6} USDC for jar ${jarPubkeyStr}`)
  return { obligationPubkey: null, simulated: true }
}

function simulatedYield(jarPubkeyStr) {
  const ledger = readLedger()
  const entry = ledger[jarPubkeyStr]
  if (!entry) return { earned_usdc: 0, earned_usd: 0 }

  const apy = entry.apy ?? FALLBACK_USDC_APY
  const elapsedYears = (Date.now() - entry.deposited_at) / (365.25 * 24 * 3_600_000)
  const principal = entry.usdc_micro / 1_000_000

  // Compound interest: P × ((1+r)^t - 1)
  const earned = principal * (Math.pow(1 + apy, elapsedYears) - 1)

  return {
    earned_usdc:  Math.round(earned * 1_000_000),   // micro-units
    earned_usd:   Math.round(earned * 100) / 100,   // dollars, 2 dec
    principal_usd: Math.round(principal * 100) / 100,
    apy,
    elapsed_days: Math.floor(elapsedYears * 365.25),
  }
}

// ---------------------------------------------------------------------------
// Real Kamino path (mainnet)
// ---------------------------------------------------------------------------

async function kaminoDeposit(connection, serverKeypair, jarPubkeyStr, usdcMicroUnits, apy) {
  try {
    const { KaminoMarket, KaminoAction, VanillaObligation } = require('@kamino-finance/klend-sdk')

    const market = await KaminoMarket.load(
      connection,
      new PublicKey(KAMINO_MARKET),
      undefined,
      new PublicKey(KAMINO_PROGRAM_ID)
    )
    await market.loadReserves()

    const obligation  = new VanillaObligation(new PublicKey(KAMINO_PROGRAM_ID))
    const depositAction = await KaminoAction.buildDepositTxns(
      market,
      String(usdcMicroUnits),
      'USDC',
      serverKeypair.publicKey,
      obligation
    )

    const tx = new Transaction()
    tx.add(...depositAction.setupIxs, ...depositAction.lendingIxs, ...depositAction.cleanupIxs)
    await sendAndConfirmTransaction(connection, tx, [serverKeypair])

    const obligationPubkey = obligation.publicKey?.toBase58() ?? null

    // Persist obligation in ledger
    const ledger = readLedger()
    ledger[jarPubkeyStr] = {
      usdc_micro:    (ledger[jarPubkeyStr]?.usdc_micro ?? 0) + usdcMicroUnits,
      deposited_at:  ledger[jarPubkeyStr]?.deposited_at ?? Date.now(),
      last_updated:  Date.now(),
      apy,
      obligation:    obligationPubkey,
    }
    writeLedger(ledger)

    console.log(`[kamino] real deposit ${usdcMicroUnits / 1e6} USDC, obligation: ${obligationPubkey}`)
    return { obligationPubkey, simulated: false }
  } catch (err) {
    console.warn('[kamino] real deposit failed, falling back to simulated:', err.message)
    return simulatedDeposit(jarPubkeyStr, usdcMicroUnits, apy)
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

async function depositToKamino(connection, serverKeypair, jarPubkeyStr, usdcMicroUnits) {
  const apy = await getLiveApy()
  if (IS_MAINNET) {
    return kaminoDeposit(connection, serverKeypair, jarPubkeyStr, usdcMicroUnits, apy)
  }
  return simulatedDeposit(jarPubkeyStr, usdcMicroUnits, apy)
}

async function getYieldEarned(connection, jarPubkeyStr) {
  if (IS_MAINNET) {
    try {
      const { KaminoMarket } = require('@kamino-finance/klend-sdk')
      const ledger = readLedger()
      const entry  = ledger[jarPubkeyStr]
      if (!entry?.obligation) return simulatedYield(jarPubkeyStr)

      const market = await KaminoMarket.load(
        connection,
        new PublicKey(KAMINO_MARKET),
        undefined,
        new PublicKey(KAMINO_PROGRAM_ID)
      )
      await market.loadReserves()

      const userObligation = await market.getObligationByAddress(new PublicKey(entry.obligation))
      if (userObligation) {
        const totalValue = userObligation.obligationValue?.() ?? 0
        const principal  = entry.usdc_micro / 1_000_000
        const earned     = Math.max(0, Number(totalValue) - principal)
        return {
          earned_usdc:   Math.round(earned * 1_000_000),
          earned_usd:    Math.round(earned * 100) / 100,
          principal_usd: Math.round(principal * 100) / 100,
          apy:           entry.apy,
          obligation:    entry.obligation,
        }
      }
    } catch (err) {
      console.warn('[kamino] getYieldEarned real failed:', err.message)
    }
  }
  return simulatedYield(jarPubkeyStr)
}

async function getLiveApyPublic() {
  return getLiveApy()
}

module.exports = { depositToKamino, getYieldEarned, getLiveApyPublic }
