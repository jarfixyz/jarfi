require('dotenv').config()
const express = require('express')
const cors = require('cors')
const crypto = require('crypto')
const anchor = require('@coral-xyz/anchor')
const {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
} = require('@solana/web3.js')
const {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} = require('@solana/spl-token')

const IDL = require('./idl.json')
const { depositToKamino, getYieldEarned, getLiveApyPublic } = require('./kaminoService')

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

async function getOrCreateATA(owner) {
  return getAssociatedTokenAddress(usdcMint(), owner)
}

// ---------------------------------------------------------------------------
// Express setup
// ---------------------------------------------------------------------------

const app = express()
app.use(cors())

app.use('/moonpay-webhook',     express.raw({ type: '*/*' }))
app.use('/guardarian-webhook',  express.raw({ type: '*/*' }))
app.use('/transak-webhook',     express.raw({ type: '*/*' }))
app.use(express.json())

// ---------------------------------------------------------------------------
// GET /
// ---------------------------------------------------------------------------

app.get('/', (req, res) => {
  res.json({
    ok: true,
    message: 'JAR backend running',
    wallet: serverKeypair.publicKey.toBase58(),
    rpc: RPC_URL,
  })
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

    res.json({
      ok: true,
      jar: {
        pubkey:               jarPubkey.toBase58(),
        owner:                jar.owner.toBase58(),
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
  const contributorUsdcAccount = await getOrCreateATA(serverKeypair.publicKey)
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
      const jwt = require('jsonwebtoken')
      payload = jwt.verify(rawBody, secret)
    } else {
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

    const parts = partnerOrderId.split('__')
    const contributorMessage = parts.length >= 3
      ? decodeURIComponent(parts.slice(2).join('__')).slice(0, 120)
      : transakOrderId

    if (!vaultAddress) {
      return res.status(400).json({ ok: false, error: 'walletAddress (jar pubkey) missing' })
    }

    const jarPubkey = new PublicKey(vaultAddress)

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

    if (isUsdcJar) {
      const usdcMicroUnits = Math.round(cryptoAmount * 1_000_000)
      txSignature = await onrampDepositUsdc(jarPubkey, usdcMicroUnits, contributorMessage)
      console.log('[transak-webhook] gift_deposit_usdc tx:', txSignature)

      // Auto-stake into Kamino after on-chain deposit
      depositToKamino(connection, serverKeypair, jarPubkey.toBase58(), usdcMicroUnits)
        .then(r => console.log('[kamino] auto-stake result:', r))
        .catch(e => console.warn('[kamino] auto-stake failed:', e.message))
    } else {
      // SOL jar — Jupiter swap USDC→SOL then deposit (TODO: implement Jupiter swap)
      // For now: record as legacy gift_deposit with fiat cents
      const contributionKeypair = Keypair.generate()
      const amountUnits = Math.round(fiatAmount * 100)
      txSignature = await program.methods
        .giftDeposit(new anchor.BN(amountUnits), contributorMessage)
        .accounts({
          jar:           jarPubkey,
          contribution:  contributionKeypair.publicKey,
          contributor:   serverKeypair.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([contributionKeypair])
        .rpc()
      console.log('[transak-webhook] gift_deposit (SOL jar, swap TODO) tx:', txSignature)
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
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString() : JSON.stringify(req.body)
    const payload = rawBody ? JSON.parse(rawBody) : {}
    const status  = payload.status || payload.transaction_status
    if (status !== 'finished') return res.json({ ok: true, skipped: true, status })
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
    res.json({ ok: true, txSignature: tx })
  } catch (err) {
    console.error('[guardarian-webhook]', err.message)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ---------------------------------------------------------------------------

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`JAR backend on port ${PORT}`)
  console.log(`Server wallet: ${serverKeypair.publicKey.toBase58()}`)
  console.log(`RPC: ${RPC_URL}`)
})
