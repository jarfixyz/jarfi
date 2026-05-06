require('dotenv').config()
const express = require('express')
const cors = require('cors')
const crypto = require('crypto')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const jwt = require('jsonwebtoken')
const anchor = require('@coral-xyz/anchor')
const {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
} = require('@solana/web3.js')
const {
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} = require('@solana/spl-token')

const webpush = require('web-push')

const IDL = require('./idl.json')
const { depositToKamino, getYieldEarned, getLiveApyPublic } = require('./kaminoService')
const { stakeWithMarinade } = require('./marinadeService')
const { swapUsdcToSol } = require('./jupiterService')
const dbMod = require('./db')
const { isWebhookProcessed, markWebhookProcessed, saveJarMeta, getJarMeta, deleteJarMeta } = dbMod
const { createGroup, getGroup, joinGroup, listGroupsByOwner } = require('./groupService')
const {
  addSchedule,
  updateSchedule,
  getSchedulesByOwner,
  deleteSchedule,
  savePushSubscription,
  getPushSubscription,
  startCronRunner,
} = require('./scheduleService')

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USDC_MINT_DEVNET  = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU')
const USDC_MINT_MAINNET = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
const VAULT_SEED = Buffer.from('vault')
const CURRENCY_USDC = 0
const CURRENCY_SOL  = 1

function usdcMint() {
  return process.env.SOLANA_NETWORK === 'mainnet' ? USDC_MINT_MAINNET : USDC_MINT_DEVNET
}

// ---------------------------------------------------------------------------
// Solana / Anchor setup
// ---------------------------------------------------------------------------

const RPC_URL = process.env.SOLANA_RPC_URL || clusterApiUrl('devnet')
const connection = new Connection(RPC_URL, 'confirmed')

let serverKeypair
if (process.env.SERVER_WALLET_SECRET) {
  serverKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(process.env.SERVER_WALLET_SECRET))
  )
} else {
  serverKeypair = Keypair.generate()
  console.warn('[warn] SERVER_WALLET_SECRET not set — using ephemeral wallet')
}

const wallet = new anchor.Wallet(serverKeypair)
const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' })
anchor.setProvider(provider)

const PROGRAM_ID = new PublicKey('HtQt8P4pcF2X4D9oxWwsafj5KnwJsUPF148mvkZMQaFW')
const program = new anchor.Program(IDL, provider)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getVaultAuthority(jarPubkey) {
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [VAULT_SEED, jarPubkey.toBuffer()],
    PROGRAM_ID
  )
  return vaultAuthority
}

async function getJarUsdcVault(jarPubkey) {
  const vaultAuthority = await getVaultAuthority(jarPubkey)
  return getAssociatedTokenAddress(usdcMint(), vaultAuthority, true)
}

async function getOrCreateServerUsdcATA() {
  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    serverKeypair,
    usdcMint(),
    serverKeypair.publicKey
  )
  return ata.address
}

// ---------------------------------------------------------------------------
// Express setup
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// VAPID / web-push setup
// ---------------------------------------------------------------------------

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:hello@jarfi.xyz',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
  console.log('[push] VAPID configured')
} else {
  console.warn('[push] VAPID keys not set — push notifications disabled')
}

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['https://jarfi.xyz', 'https://www.jarfi.xyz', 'http://localhost:3000']

const app = express()
app.set('trust proxy', 1) // Railway sits behind a proxy — needed for express-rate-limit
app.use(helmet())
app.use(cors({ origin: ALLOWED_ORIGINS, optionsSuccessStatus: 200 }))

const apiLimiter = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false })
const webhookLimiter = rateLimit({ windowMs: 60_000, max: 30 })
app.use('/jar', apiLimiter)
app.use('/schedule', apiLimiter)
app.use('/group', apiLimiter)
app.use('/push', apiLimiter)
app.use('/transak-webhook',    webhookLimiter)
app.use('/moonpay-webhook',    webhookLimiter)
app.use('/guardarian-webhook', webhookLimiter)

app.use('/moonpay-webhook',     express.raw({ type: '*/*' }))
app.use('/guardarian-webhook',  express.raw({ type: '*/*' }))
app.use('/transak-webhook',     express.raw({ type: '*/*' }))
app.use(express.json())

// ---------------------------------------------------------------------------
// GET /
// ---------------------------------------------------------------------------

app.get('/', (req, res) => {
  res.json({ ok: true, message: 'JAR backend running' })
})

// ---------------------------------------------------------------------------
// POST /jar/create
//
// Body:
//   mode        0 = date only | 1 = goal only | 2 = either/first
//   unlockDate  unix timestamp (seconds)
//   goalAmount  u64 (lamports for SOL | USDC micro-units 6dec for USDC)
//   childWallet base58 pubkey
//   currency    "usdc" | "sol"  (default: "usdc")
// ---------------------------------------------------------------------------

app.post('/jar/create', async (req, res) => {
  try {
    const {
      mode = 0,
      unlockDate = 0,
      goalAmount = 0,
      childWallet,
      currency = 'usdc',
    } = req.body

    if (!childWallet) return res.status(400).json({ ok: false, error: 'childWallet is required' })
    if (mode < 0 || mode > 2) return res.status(400).json({ ok: false, error: 'mode must be 0–2' })

    const jarKeypair       = Keypair.generate()
    const childWalletPubkey = new PublicKey(childWallet)

    let txSignature

    if (currency === 'usdc') {
      const mint           = usdcMint()
      const vaultAuthority = await getVaultAuthority(jarKeypair.publicKey)
      const jarUsdcVault   = await getAssociatedTokenAddress(mint, vaultAuthority, true)

      txSignature = await program.methods
        .createUsdcJar(
          mode,
          new anchor.BN(unlockDate),
          new anchor.BN(goalAmount),
          childWalletPubkey
        )
        .accounts({
          jar:                    jarKeypair.publicKey,
          vaultAuthority,
          jarUsdcVault,
          usdcMint:               mint,
          owner:                  serverKeypair.publicKey,
          systemProgram:          anchor.web3.SystemProgram.programId,
          tokenProgram:           TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([jarKeypair])
        .rpc()
    } else {
      txSignature = await program.methods
        .createJar(
          mode,
          new anchor.BN(unlockDate),
          new anchor.BN(goalAmount),
          childWalletPubkey
        )
        .accounts({
          jar:           jarKeypair.publicKey,
          owner:         serverKeypair.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([jarKeypair])
        .rpc()
    }

    console.log(`[/jar/create] ${currency} jar:`, jarKeypair.publicKey.toBase58(), 'tx:', txSignature)

    res.json({
      ok: true,
      jarPubkey: jarKeypair.publicKey.toBase58(),
      currency,
      txSignature,
    })
  } catch (err) {
    console.error('[/jar/create]', err.message)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ---------------------------------------------------------------------------
// POST /jar/meta  — save off-chain name + emoji for a jar
// ---------------------------------------------------------------------------

function nameToSlug(name) {
  const base = (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 24)
  return base || 'jar'
}

function uniqueSlug(base) {
  let slug = base
  let i = 2
  while (dbMod.getJarMetaBySlug(slug)) {
    slug = `${base}-${i}`
    i++
  }
  return slug
}

app.post('/jar/meta', (req, res) => {
  try {
    const { pubkey, name, emoji, jarType } = req.body
    if (!pubkey) return res.status(400).json({ ok: false, error: 'pubkey required' })
    const existing = getJarMeta(pubkey)
    let slug = existing?.share_slug
    if (!slug) {
      slug = uniqueSlug(nameToSlug(name))
    }
    saveJarMeta(pubkey, name ?? '', emoji ?? '🏺', jarType ?? '', slug)
    res.json({ ok: true, share_slug: slug })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

app.delete('/jar/meta/:pubkey', (req, res) => {
  try {
    const { pubkey } = req.params
    if (!pubkey) return res.status(400).json({ ok: false, error: 'pubkey required' })
    const deleted = deleteJarMeta(pubkey)
    res.json({ ok: true, deleted })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

app.get('/jar/by-slug/:slug', (req, res) => {
  const dbMod = require('./db')
  const row = dbMod.getJarMetaBySlug(req.params.slug)
  if (!row) return res.status(404).json({ ok: false, error: 'not found' })
  res.json({ ok: true, pubkey: row.pubkey, name: row.name, emoji: row.emoji })
})

// ---------------------------------------------------------------------------
// GET /jar/:pubkey
// ---------------------------------------------------------------------------

app.get('/jar/:pubkey', async (req, res) => {
  try {
    const jarPubkey = new PublicKey(req.params.pubkey)
    const jar = await program.account.jar.fetch(jarPubkey)

    const contributions = await program.account.contribution.all([
      { memcmp: { offset: 8, bytes: jarPubkey.toBase58() } },
    ])

    // For USDC jars: vault token balance + Kamino yield
    let vaultTokenBalance = null
    let kaminoYield = null
    if (jar.jarCurrency === CURRENCY_USDC) {
      try {
        const jarUsdcVault = await getJarUsdcVault(jarPubkey)
        const tokenBal = await connection.getTokenAccountBalance(jarUsdcVault)
        vaultTokenBalance = tokenBal.value
      } catch { /* vault may not exist yet */ }

      try {
        kaminoYield = await getYieldEarned(connection, jarPubkey.toBase58())
      } catch (e) {
        console.warn('[/jar/:pubkey] kamino yield error:', e.message)
      }
    }

    const meta = getJarMeta(jarPubkey.toBase58())

    res.json({
      ok: true,
      jar: {
        pubkey:               jarPubkey.toBase58(),
        owner:                jar.owner.toBase58(),
        name:                 meta?.name || null,
        emoji:                meta?.emoji || null,
        jarType:              meta?.jar_type || null,
        mode:                 jar.mode,
        unlockDate:           jar.unlockDate.toNumber(),
        goalAmount:           jar.goalAmount.toNumber(),
        balance:              jar.balance.toNumber(),
        stakingShares:        jar.stakingShares.toNumber(),
        createdAt:            jar.createdAt.toNumber(),
        dailyLimit:           jar.dailyLimit.toNumber(),
        weeklyLimit:          jar.weeklyLimit.toNumber(),
        childWallet:          jar.childWallet.toBase58(),
        childSpendableBalance:jar.childSpendableBalance.toNumber(),
        unlocked:             jar.unlocked,
        jarCurrency:          jar.jarCurrency,       // 0=USDC, 1=SOL
        usdcBalance:          jar.usdcBalance.toNumber(),
        usdcVault:            jar.usdcVault.toBase58(),
        vaultTokenBalance,                           // live on-chain token balance
        kaminoYield,                                 // { earned_usd, earned_usdc, apy, ... }
      },
      contributions: contributions.map(({ publicKey, account }) => ({
        pubkey:      publicKey.toBase58(),
        contributor: account.contributor.toBase58(),
        amount:      account.amount.toNumber(),
        comment:     account.comment,
        createdAt:   account.createdAt.toNumber(),
      })),
    })
  } catch (err) {
    console.error('[/jar/:pubkey]', err.message)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ---------------------------------------------------------------------------
// GET /apy
// Returns live APY for USDC (Kamino) and SOL (Marinade)
// ---------------------------------------------------------------------------

app.get('/apy', async (req, res) => {
  const FALLBACK = { usdc_kamino: 8.2, sol_marinade: 6.85 }
  try {
    const [kaminoApy, marinadeRes] = await Promise.allSettled([
      getLiveApyPublic(),
      fetch('https://api.marinade.finance/msol/apy/1y').then(r => r.json()),
    ])
    const usdcApy = kaminoApy.status === 'fulfilled'
      ? Math.round(kaminoApy.value * 10000) / 100
      : FALLBACK.usdc_kamino
    const solApy = marinadeRes.status === 'fulfilled'
      ? Math.round((marinadeRes.value?.value || 0.0685) * 10000) / 100
      : FALLBACK.sol_marinade

    res.json({ ok: true, usdc_kamino: usdcApy, sol_marinade: solApy })
  } catch {
    res.json({ ok: true, ...FALLBACK })
  }
})

// ---------------------------------------------------------------------------
// Internal: gift_deposit_usdc — called after Transak/onramp confirms USDC
//
// Transfers USDC from server wallet ATA → jar vault, records Contribution.
// ---------------------------------------------------------------------------

async function onrampDepositUsdc(jarPubkey, cryptoAmount, comment) {
  const mint                   = usdcMint()
  const vaultAuthority         = await getVaultAuthority(jarPubkey)
  const jarUsdcVault           = await getAssociatedTokenAddress(mint, vaultAuthority, true)
  const contributorUsdcAccount = await getOrCreateServerUsdcATA()
  const contributionKeypair    = Keypair.generate()

  const txSignature = await program.methods
    .giftDepositUsdc(new anchor.BN(cryptoAmount), comment)
    .accounts({
      jar:                    jarPubkey,
      jarUsdcVault,
      vaultAuthority,
      contribution:           contributionKeypair.publicKey,
      contributorUsdcAccount,
      usdcMint:               mint,
      contributor:            serverKeypair.publicKey,
      systemProgram:          anchor.web3.SystemProgram.programId,
      tokenProgram:           TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .signers([contributionKeypair])
    .rpc()

  return txSignature
}

// ---------------------------------------------------------------------------
// POST /transak-webhook
// ---------------------------------------------------------------------------

app.post('/transak-webhook', async (req, res) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString() : JSON.stringify(req.body)

    let payload
    const secret = process.env.TRANSAK_API_SECRET
    if (secret) {
      payload = jwt.verify(rawBody, secret)
    } else {
      console.warn('[transak-webhook] TRANSAK_API_SECRET not set — skipping JWT verification')
      payload = JSON.parse(rawBody)
    }

    const eventID = payload.eventID || payload.event_id
    console.log('[transak-webhook] event:', eventID)

    if (eventID !== 'ORDER_COMPLETED') {
      return res.json({ ok: true, skipped: true, eventID })
    }

    const data          = payload.webhookData || payload.data || {}
    const vaultAddress  = data.walletAddress || data.wallet_address
    const fiatAmount    = Number(data.fiatAmount    || data.fiat_amount    || 0)
    const cryptoAmount  = Number(data.cryptoAmount  || data.crypto_amount  || 0)
    const partnerOrderId = data.partnerOrderId || data.partner_order_id || ''
    const transakOrderId = data.id || ''

    const dedupId = transakOrderId || partnerOrderId
    if (dedupId && isWebhookProcessed(dedupId)) {
      console.log('[transak-webhook] duplicate, skipping:', dedupId)
      return res.json({ ok: true, skipped: true, reason: 'duplicate' })
    }

    const parts = partnerOrderId.split('__')
    const rawMsg = parts.length >= 3 && parts[2].trim()
      ? decodeURIComponent(parts.slice(2).join('__'))
      : ''
    const contributorMessage = (rawMsg || 'gift deposit').slice(0, 120)

    if (!vaultAddress) {
      return res.status(400).json({ ok: false, error: 'walletAddress (jar pubkey) missing' })
    }

    let jarPubkey
    try {
      jarPubkey = new PublicKey(vaultAddress)
    } catch {
      return res.status(400).json({ ok: false, error: `Invalid jar pubkey: ${vaultAddress}` })
    }

    // Fetch jar to determine currency
    let jar
    try {
      jar = await program.account.jar.fetch(jarPubkey)
    } catch (e) {
      console.warn('[transak-webhook] could not fetch jar, assuming USDC:', e.message)
    }

    const isUsdcJar = !jar || jar.jarCurrency === CURRENCY_USDC

    console.log('[transak-webhook] ORDER_COMPLETED', {
      vaultAddress, fiatAmount, cryptoAmount, isUsdcJar, contributorMessage,
    })

    let txSignature

    if (dedupId) markWebhookProcessed(dedupId, 'transak')

    if (isUsdcJar) {
      const usdcMicroUnits = Math.round(cryptoAmount * 1_000_000)
      txSignature = await onrampDepositUsdc(jarPubkey, usdcMicroUnits, contributorMessage)
      console.log('[transak-webhook] gift_deposit_usdc tx:', txSignature)

      // Auto-stake into Kamino after on-chain deposit
      depositToKamino(connection, serverKeypair, jarPubkey.toBase58(), usdcMicroUnits)
        .then(r => console.log('[kamino] auto-stake result:', r))
        .catch(e => console.error('[kamino] auto-stake FAILED — yield NOT accrued:', e))
    } else {
      // SOL jar — Jupiter swap USDC→SOL, then on-chain deposit + Marinade stake
      const usdcMicroUnits = Math.round(cryptoAmount * 1_000_000)

      const { signature: swapSig, outLamports } = await swapUsdcToSol(
        connection, serverKeypair, usdcMicroUnits
      )
      console.log('[transak-webhook] jupiter swap tx:', swapSig, 'lamports:', outLamports)

      // Deposit SOL on-chain into jar
      txSignature = await program.methods
        .deposit(new anchor.BN(outLamports))
        .accounts({
          jar:           jarPubkey,
          depositor:     serverKeypair.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc()
      console.log('[transak-webhook] deposit SOL tx:', txSignature)

      // Auto-stake into Marinade (async)
      stakeWithMarinade(connection, serverKeypair, outLamports)
        .then(async ({ signature: stakeSig, msol_lamports }) => {
          console.log('[marinade] staked, mSOL:', msol_lamports, 'tx:', stakeSig)
          await recordMarinadeStake(jarPubkey, msol_lamports)
        })
        .catch(e => console.error('[marinade] stake FAILED — staking_shares NOT updated:', e))
    }

    res.json({ ok: true, txSignature })
  } catch (err) {
    console.error('[transak-webhook]', err.message)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ---------------------------------------------------------------------------
// POST /moonpay-webhook  (unchanged — SOL mode only)
// ---------------------------------------------------------------------------

app.post('/moonpay-webhook', async (req, res) => {
  try {
    const rawBody = req.body.toString()
    const moonpaySecret = process.env.MOONPAY_SECRET_KEY
    if (moonpaySecret) {
      const header = req.headers['moonpay-signature-1'] || ''
      const parts  = Object.fromEntries(header.split(',').map(p => p.split('=')))
      const expected = crypto
        .createHmac('sha256', moonpaySecret)
        .update(`${parts['t']}.${rawBody}`)
        .digest('hex')
      if (expected !== parts['s']) {
        return res.status(401).json({ ok: false, error: 'Invalid signature' })
      }
    }
    const payload = JSON.parse(rawBody)
    if (payload?.transaction?.status !== 'completed') {
      return res.json({ ok: true, skipped: true })
    }
    const amountUnits = Math.round((payload.transaction.baseCurrencyAmount || 0) * 100)
    const jarPubkey   = new PublicKey(payload.transaction.externalTransactionId)
    const comment     = (payload.transaction.notes || '').slice(0, 120)
    const contributionKeypair = Keypair.generate()
    const tx = await program.methods
      .giftDeposit(new anchor.BN(amountUnits), comment)
      .accounts({ jar: jarPubkey, contribution: contributionKeypair.publicKey, contributor: serverKeypair.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
      .signers([contributionKeypair])
      .rpc()
    res.json({ ok: true, txSignature: tx })
  } catch (err) {
    console.error('[moonpay-webhook]', err.message)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ---------------------------------------------------------------------------
// POST /guardarian-webhook  (unchanged)
// ---------------------------------------------------------------------------

app.post('/guardarian-webhook', async (req, res) => {
  try {
    const guardarianSecret = process.env.GUARDARIAN_WEBHOOK_SECRET
    if (guardarianSecret) {
      const provided = req.headers['x-guardarian-signature'] || req.headers['authorization'] || ''
      if (provided !== guardarianSecret) {
        console.warn('[guardarian-webhook] invalid signature')
        return res.status(401).json({ ok: false, error: 'Unauthorized' })
      }
    } else {
      console.warn('[guardarian-webhook] GUARDARIAN_WEBHOOK_SECRET not set — skipping verification')
    }

    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString() : JSON.stringify(req.body)
    const payload = rawBody ? JSON.parse(rawBody) : {}
    const status  = payload.status || payload.transaction_status
    if (status !== 'finished') return res.json({ ok: true, skipped: true, status })

    const orderId = String(payload.id || payload.order_id || '')
    if (orderId && isWebhookProcessed(orderId)) {
      return res.json({ ok: true, skipped: true, reason: 'duplicate' })
    }
    const jarPubkeyStr = payload.payout_address || payload.wallet_address
    const amountPaid   = Number(payload.from_amount || 0)
    const comment      = String(payload.output_hash || '').slice(0, 120)
    const amountUnits  = Math.round(amountPaid * 100)
    const jarPubkey    = new PublicKey(jarPubkeyStr)
    const contributionKeypair = Keypair.generate()
    const tx = await program.methods
      .giftDeposit(new anchor.BN(amountUnits), comment)
      .accounts({ jar: jarPubkey, contribution: contributionKeypair.publicKey, contributor: serverKeypair.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
      .signers([contributionKeypair])
      .rpc()
    if (orderId) markWebhookProcessed(orderId, 'guardarian')
    res.json({ ok: true, txSignature: tx })
  } catch (err) {
    console.error('[guardarian-webhook]', err.message)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ---------------------------------------------------------------------------
// POST /schedule/create
//
// Body:
//   jar_pubkey    base58 pubkey
//   owner_pubkey  base58 pubkey (wallet owner)
//   amount_usdc   integer cents (e.g. 1000 = $10.00)
//   frequency     "weekly" | "monthly"
//   day           weekly: 0-6 (Sun=0) | monthly: 1-28
//   hour          0-23
//   minute        0-59
// ---------------------------------------------------------------------------

app.post('/schedule/create', (req, res) => {
  try {
    const { jar_pubkey, owner_pubkey, amount_usdc, frequency, day, hour, minute } = req.body
    if (!jar_pubkey || !owner_pubkey || !amount_usdc || !frequency) {
      return res.status(400).json({ ok: false, error: 'missing required fields' })
    }
    const schedule = addSchedule({
      jar_pubkey,
      owner_pubkey,
      amount_usdc: Number(amount_usdc),
      frequency,
      day: Number(day ?? 1),
      hour: Number(hour ?? 9),
      minute: Number(minute ?? 0),
    })
    res.json({ ok: true, schedule })
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message })
  }
})

// ---------------------------------------------------------------------------
// GET /schedule/:owner_pubkey
// ---------------------------------------------------------------------------

app.get('/schedule/:owner_pubkey', (req, res) => {
  const schedules = getSchedulesByOwner(req.params.owner_pubkey)
  res.json({ ok: true, schedules })
})

// ---------------------------------------------------------------------------
// DELETE /schedule/:id
// ---------------------------------------------------------------------------

app.delete('/schedule/:id', (req, res) => {
  const deleted = deleteSchedule(req.params.id)
  res.json({ ok: deleted })
})

// ---------------------------------------------------------------------------
// PUT /schedule/:id  — update amount/frequency/day/hour/minute
// ---------------------------------------------------------------------------

app.put('/schedule/:id', (req, res) => {
  try {
    const { amount_usdc, frequency, day, hour, minute } = req.body
    if (!amount_usdc || !frequency) return res.status(400).json({ ok: false, error: 'missing fields' })
    const updated = updateSchedule(req.params.id, {
      amount_usdc: Number(amount_usdc),
      frequency,
      day: Number(day ?? 1),
      hour: Number(hour ?? 9),
      minute: Number(minute ?? 0),
    })
    if (!updated) return res.status(404).json({ ok: false, error: 'schedule not found' })
    res.json({ ok: true })
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message })
  }
})

// ---------------------------------------------------------------------------
// POST /schedule/test-fire/:id  — fire a schedule immediately (devnet testing)
// ---------------------------------------------------------------------------

app.post('/schedule/test-fire/:id', async (req, res) => {
  const dbMod = require('./db')
  const all = dbMod.getActiveSchedules()
  const schedule = all.find(s => s.id === req.params.id)
  if (!schedule) return res.status(404).json({ ok: false, error: 'schedule not found' })

  const jarPubkey = new PublicKey(schedule.jar_pubkey)
  const usdcMicroUnits = schedule.amount_usdc * 10_000
  const amountUsd = (schedule.amount_usdc / 100).toFixed(2)

  let depositOk = false
  let depositTx = null
  try {
    depositTx = await onrampDepositUsdc(jarPubkey, usdcMicroUnits, 'Test recurring deposit 🔄')
    depositOk = true
    console.log(`[test-fire] auto-deposit OK: $${amountUsd} → ${schedule.jar_pubkey} tx:`, depositTx)

    depositToKamino(connection, serverKeypair, schedule.jar_pubkey, usdcMicroUnits)
      .then(r => console.log('[test-fire] kamino stake:', r))
      .catch(e => console.error('[test-fire] kamino stake FAILED:', e))
  } catch (e) {
    console.warn(`[test-fire] deposit failed: ${e.message}`)
  }

  res.json({ ok: true, depositOk, depositTx, amount_usd: amountUsd })
})

// ---------------------------------------------------------------------------
// POST /push/subscribe
//
// Body:
//   owner_pubkey   base58 pubkey
//   subscription   PushSubscription object from browser
// ---------------------------------------------------------------------------

app.post('/push/subscribe', (req, res) => {
  const { owner_pubkey, subscription } = req.body
  if (!owner_pubkey || !subscription) {
    return res.status(400).json({ ok: false, error: 'missing owner_pubkey or subscription' })
  }
  savePushSubscription(owner_pubkey, subscription)
  res.json({ ok: true })
})

// ---------------------------------------------------------------------------
// GET /push/vapid-public-key
// ---------------------------------------------------------------------------

app.get('/push/vapid-public-key', (req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY
  if (!key) return res.status(503).json({ ok: false, error: 'VAPID not configured' })
  res.json({ ok: true, publicKey: key })
})

// ---------------------------------------------------------------------------
// Helper: call record_marinade_stake on-chain after SDK stake
// ---------------------------------------------------------------------------

async function recordMarinadeStake(jarPubkey, msolShares) {
  await program.methods
    .recordMarinadeStake(new anchor.BN(msolShares))
    .accounts({
      jar: jarPubkey,
      owner: serverKeypair.publicKey,
    })
    .rpc()
}

// ---------------------------------------------------------------------------
// POST /jar/deposit-sol
//
// Body:
//   jar_pubkey   base58 pubkey
//   lamports     u64 — amount in lamports to deposit (server wallet pays)
//
// Server wallet deposits SOL into the jar on-chain, then stakes with Marinade.
// ---------------------------------------------------------------------------

app.post('/jar/deposit-sol', async (req, res) => {
  try {
    const { jar_pubkey, lamports } = req.body
    if (!jar_pubkey || !lamports) {
      return res.status(400).json({ ok: false, error: 'jar_pubkey and lamports required' })
    }

    const jarPubkey = new PublicKey(jar_pubkey)
    const amount = Number(lamports)

    // 1. Call on-chain deposit (transfers SOL from server wallet → jar)
    const depositTx = await program.methods
      .deposit(new anchor.BN(amount))
      .accounts({
        jar: jarPubkey,
        depositor: serverKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc()
    console.log('[deposit-sol] on-chain deposit tx:', depositTx)

    // 2. Stake with Marinade (async, non-blocking)
    stakeWithMarinade(connection, serverKeypair, amount)
      .then(async ({ signature, msol_lamports }) => {
        console.log('[marinade] staked, mSOL lamports:', msol_lamports, 'tx:', signature)
        // 3. Record mSOL shares on-chain
        await recordMarinadeStake(jarPubkey, msol_lamports)
        console.log('[marinade] recorded staking_shares:', msol_lamports)
      })
      .catch(e => console.error('[marinade] stake FAILED — staking_shares NOT updated:', e))

    res.json({ ok: true, depositTx })
  } catch (err) {
    console.error('[/jar/deposit-sol]', err.message)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ---------------------------------------------------------------------------
// Group Trip endpoints
// ---------------------------------------------------------------------------

// Fetch on-chain contributions for a jar, grouped by contributor pubkey → USDC micro-units
async function getContributionsByMember(jarPubkey) {
  const contributions = await program.account.contribution.all([
    { memcmp: { offset: 8, bytes: jarPubkey.toBase58() } },
  ])
  const totals = {}
  for (const { account } of contributions) {
    const key = account.contributor.toBase58()
    totals[key] = (totals[key] || 0) + account.amount.toNumber()
  }
  return totals
}

function enrichGroupMembers(group, contributionsByMember) {
  const members = group.members.map(m => {
    // USDC micro-units (6 dec) → cents: /1_000_000 * 100 = /10_000
    const contributed_cents = Math.round((contributionsByMember[m.pubkey] || 0) / 10_000)
    const progress_pct = group.budget_per_person_cents > 0
      ? Math.min(100, Math.round(contributed_cents / group.budget_per_person_cents * 100))
      : 0
    return { ...m, contributed_cents, progress_pct }
  })
  const total_contributed = members.reduce((s, m) => s + m.contributed_cents, 0)
  const total_goal_cents = group.budget_per_person_cents * group.members.length
  return {
    ...group,
    members,
    total_contributed,
    total_goal_cents,
    total_progress_pct: total_goal_cents > 0
      ? Math.min(100, Math.round(total_contributed / total_goal_cents * 100))
      : 0,
  }
}

// POST /group/create
// Body: { jar_pubkey, trip_name, destination_emoji, trip_date, budget_per_person_cents, owner_pubkey, owner_nickname }
app.post('/group/create', (req, res) => {
  const { jar_pubkey, trip_name, destination_emoji, trip_date, budget_per_person_cents, owner_pubkey, owner_nickname } = req.body
  if (!jar_pubkey || !trip_name || !owner_pubkey || !budget_per_person_cents) {
    return res.status(400).json({ ok: false, error: 'missing required fields' })
  }
  const group = createGroup({ jar_pubkey, trip_name, destination_emoji, trip_date: Number(trip_date), budget_per_person_cents: Number(budget_per_person_cents), owner_pubkey, owner_nickname })
  res.json({ ok: true, group })
})

// GET /group/:jar_pubkey
app.get('/group/:jar_pubkey', async (req, res) => {
  const group = getGroup(req.params.jar_pubkey)
  if (!group) return res.status(404).json({ ok: false, error: 'group not found' })
  let byMember = {}
  try {
    byMember = await getContributionsByMember(new PublicKey(req.params.jar_pubkey))
  } catch (e) {
    console.warn('[/group/:jar_pubkey] contributions error:', e.message)
  }
  res.json({ ok: true, group: enrichGroupMembers(group, byMember) })
})

// POST /group/:jar_pubkey/join
// Body: { owner_pubkey, nickname }
app.post('/group/:jar_pubkey/join', async (req, res) => {
  const { owner_pubkey, nickname } = req.body
  if (!owner_pubkey) return res.status(400).json({ ok: false, error: 'owner_pubkey required' })
  const group = joinGroup({ jar_pubkey: req.params.jar_pubkey, owner_pubkey, nickname })
  if (!group) return res.status(404).json({ ok: false, error: 'group not found' })
  let byMember = {}
  try {
    byMember = await getContributionsByMember(new PublicKey(req.params.jar_pubkey))
  } catch {}
  res.json({ ok: true, group: enrichGroupMembers(group, byMember) })
})

// GET /group/by-owner/:owner_pubkey
app.get('/group/by-owner/:owner_pubkey', (req, res) => {
  const groups = listGroupsByOwner(req.params.owner_pubkey)
  res.json({ ok: true, groups })
})

// ---------------------------------------------------------------------------
// Cosigner routes (Phase 5 — soft approval scaffold)
// ---------------------------------------------------------------------------

// POST /cosigner/create  — create an invite slot for a jar
// Body: { jar_pubkey }
app.post('/cosigner/create', (req, res) => {
  try {
    const { jar_pubkey } = req.body
    if (!jar_pubkey) return res.status(400).json({ ok: false, error: 'jar_pubkey required' })
    const dbMod = require('./db')
    const invite_token = crypto.randomUUID()
    dbMod.addCosigner({ jar_pubkey, invite_token, created_at: Date.now() })
    res.json({ ok: true, invite_token })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// GET /cosigner/list/:jar_pubkey
app.get('/cosigner/list/:jar_pubkey', (req, res) => {
  const dbMod = require('./db')
  const cosigners = dbMod.getCosigners(req.params.jar_pubkey)
  res.json({ ok: true, cosigners })
})

// POST /cosigner/accept/:token  — co-signer connects wallet and accepts
// Body: { invitee_pubkey }
app.post('/cosigner/accept/:token', (req, res) => {
  try {
    const { invitee_pubkey } = req.body
    if (!invitee_pubkey) return res.status(400).json({ ok: false, error: 'invitee_pubkey required' })
    const dbMod = require('./db')
    const row = dbMod.getCosignerByToken(req.params.token)
    if (!row) return res.status(404).json({ ok: false, error: 'invalid token' })
    const ok = dbMod.acceptCosigner(req.params.token, invitee_pubkey)
    res.json({ ok, jar_pubkey: row.jar_pubkey })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// GET /cosigner/by-token/:token  — fetch jar info for invite page
app.get('/cosigner/by-token/:token', (req, res) => {
  const dbMod = require('./db')
  const row = dbMod.getCosignerByToken(req.params.token)
  if (!row) return res.status(404).json({ ok: false, error: 'invalid token' })
  const meta = dbMod.getJarMeta(row.jar_pubkey)
  res.json({ ok: true, jar_pubkey: row.jar_pubkey, status: row.status, name: meta?.name ?? '', emoji: meta?.emoji ?? '🏺' })
})

// ---------------------------------------------------------------------------

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`JAR backend on port ${PORT}`)
  console.log(`Server wallet: ${serverKeypair.publicKey.toBase58()}`)
  console.log(`RPC: ${RPC_URL}`)

  // Auto-seed demo jars on every startup (SQLite has no persistent volume on Railway)
  const DEMO_JARS = [
    { pubkey: 'FeAzYeZuvo6eaPcsVp1Yguegcp2AhwwPWTfPV5Z4B9hC', name: "Anya's Future",   emoji: '🎁', jarType: 'goal' },
    { pubkey: 'ExvN6nxRbWpqQJrpG6shY9tbcWTtHKEaJDmFVebxFqu4', name: 'Japan Trip',      emoji: '✈️', jarType: 'date' },
    { pubkey: '28teBgT2U1y25ARUkgGfHjeyBHhnJXorVtLs6Qk93ppc', name: 'Motorcycle Fund', emoji: '🏍️', jarType: 'goal' },
  ]
  for (const jar of DEMO_JARS) {
    if (!dbMod.getJarMeta(jar.pubkey)) {
      dbMod.saveJarMeta(jar.pubkey, jar.name, jar.emoji, jar.jarType)
      console.log(`[seed] demo jar: ${jar.name}`)
    }
  }

  startCronRunner(async (schedule, subscription) => {
    const shortJar = `${schedule.jar_pubkey.slice(0, 4)}…${schedule.jar_pubkey.slice(-4)}`
    const amountUsd = (schedule.amount_usdc / 100).toFixed(2)

    console.log(`[schedule] reminder fired: $${amountUsd} → ${schedule.jar_pubkey}`)

    // Send push notification — user deposits manually via Transak
    if (!subscription || !process.env.VAPID_PUBLIC_KEY) return

    const payload = JSON.stringify({
      title: 'Monthly contribution reminder 💰',
      body: `Time to add $${amountUsd} to your jar ${shortJar}`,
      data: { jar_pubkey: schedule.jar_pubkey, amount_usdc: schedule.amount_usdc, manual: true },
    })

    try {
      await webpush.sendNotification(subscription, payload)
      console.log(`[schedule] push sent to ${schedule.owner_pubkey}`)
    } catch (err) {
      console.warn(`[schedule] push failed:`, err.message)
    }
  })
})
