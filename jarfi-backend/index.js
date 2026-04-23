require('dotenv').config()
const express = require('express')
const cors = require('cors')
const crypto = require('crypto')
const anchor = require('@coral-xyz/anchor')
const { Connection, Keypair, PublicKey, clusterApiUrl } = require('@solana/web3.js')

const IDL = require('../jarfi-contract/target/idl/jarfi_contract.json')

// ---------------------------------------------------------------------------
// Solana / Anchor setup
// ---------------------------------------------------------------------------

const RPC_URL = process.env.SOLANA_RPC_URL || clusterApiUrl('devnet')
const connection = new Connection(RPC_URL, 'confirmed')

// Server wallet — signs on-chain txs on behalf of the backend
// Set SERVER_WALLET_SECRET in .env as a JSON array of byte values
// e.g. run: node -e "const {Keypair}=require('@solana/web3.js');console.log(JSON.stringify(Array.from(Keypair.generate().secretKey)))"
let serverKeypair
if (process.env.SERVER_WALLET_SECRET) {
  serverKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(process.env.SERVER_WALLET_SECRET))
  )
} else {
  // Dev fallback — ephemeral wallet, fine for local testing
  serverKeypair = Keypair.generate()
  console.warn('[warn] SERVER_WALLET_SECRET not set — using ephemeral wallet (no SOL, will fail on-chain)')
}

const wallet = new anchor.Wallet(serverKeypair)
const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' })
anchor.setProvider(provider)

const PROGRAM_ID = new PublicKey('HtQt8P4pcF2X4D9oxWwsafj5KnwJsUPF148mvkZMQaFW')
const program = new anchor.Program(IDL, provider)

// ---------------------------------------------------------------------------
// Express setup
// ---------------------------------------------------------------------------

const app = express()
app.use(cors())

// /moonpay-webhook needs raw body for signature verification — register before express.json()
app.use('/moonpay-webhook', express.raw({ type: '*/*' }))
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
//   unlockDate  unix timestamp (seconds). Required for mode 0 and 2.
//   goalAmount  u64 (lamports). Required for mode 1 and 2.
//   childWallet base58 pubkey of the child/beneficiary wallet
//
// Returns:
//   jarPubkey   base58 pubkey of the new on-chain Jar account
//   txSignature confirmed transaction signature
// ---------------------------------------------------------------------------

app.post('/jar/create', async (req, res) => {
  try {
    const { mode = 0, unlockDate = 0, goalAmount = 0, childWallet } = req.body

    if (!childWallet) {
      return res.status(400).json({ ok: false, error: 'childWallet is required' })
    }
    if (mode < 0 || mode > 2) {
      return res.status(400).json({ ok: false, error: 'mode must be 0, 1, or 2' })
    }
    if ((mode === 1 || mode === 2) && goalAmount <= 0) {
      return res.status(400).json({ ok: false, error: 'goalAmount required for mode 1 and 2' })
    }

    const jarKeypair = Keypair.generate()
    const childWalletPubkey = new PublicKey(childWallet)

    const txSignature = await program.methods
      .createJar(
        mode,
        new anchor.BN(unlockDate),
        new anchor.BN(goalAmount),
        childWalletPubkey
      )
      .accounts({
        jar: jarKeypair.publicKey,
        owner: serverKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([jarKeypair])
      .rpc()

    console.log('[/jar/create] created jar:', jarKeypair.publicKey.toBase58(), 'tx:', txSignature)

    res.json({
      ok: true,
      jarPubkey: jarKeypair.publicKey.toBase58(),
      txSignature,
    })
  } catch (err) {
    console.error('[/jar/create]', err.message)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ---------------------------------------------------------------------------
// GET /jar/:pubkey
//
// Returns full jar state + list of contributions.
// ---------------------------------------------------------------------------

app.get('/jar/:pubkey', async (req, res) => {
  try {
    const jarPubkey = new PublicKey(req.params.pubkey)

    const jar = await program.account.jar.fetch(jarPubkey)

    // Fetch all Contribution accounts whose first field (jar pubkey) matches
    const contributions = await program.account.contribution.all([
      {
        memcmp: {
          offset: 8, // skip 8-byte Anchor account discriminator
          bytes: jarPubkey.toBase58(),
        },
      },
    ])

    res.json({
      ok: true,
      jar: {
        pubkey: jarPubkey.toBase58(),
        owner: jar.owner.toBase58(),
        mode: jar.mode,
        unlockDate: jar.unlockDate.toNumber(),
        goalAmount: jar.goalAmount.toNumber(),
        balance: jar.balance.toNumber(),
        stakingShares: jar.stakingShares.toNumber(),
        createdAt: jar.createdAt.toNumber(),
        dailyLimit: jar.dailyLimit.toNumber(),
        weeklyLimit: jar.weeklyLimit.toNumber(),
        childWallet: jar.childWallet.toBase58(),
        childSpendableBalance: jar.childSpendableBalance.toNumber(),
        unlocked: jar.unlocked,
      },
      contributions: contributions.map(({ publicKey, account }) => ({
        pubkey: publicKey.toBase58(),
        contributor: account.contributor.toBase58(),
        amount: account.amount.toNumber(),
        comment: account.comment,
        createdAt: account.createdAt.toNumber(),
      })),
    })
  } catch (err) {
    console.error('[/jar/:pubkey]', err.message)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ---------------------------------------------------------------------------
// POST /moonpay-webhook
//
// Called by MoonPay when a card payment settles.
// Expects custom metadata set when creating the MoonPay widget session:
//   externalTransactionId → jar pubkey (base58)
//   notes                 → contributor message (max 120 chars)
//
// MoonPay signature header: MoonPay-Signature-1: t=<timestamp>,s=<hmac>
// ---------------------------------------------------------------------------

app.post('/moonpay-webhook', async (req, res) => {
  try {
    const rawBody = req.body.toString()

    // 1. Verify MoonPay HMAC signature (skip if secret not configured)
    const moonpaySecret = process.env.MOONPAY_SECRET_KEY
    if (moonpaySecret) {
      const header = req.headers['moonpay-signature-1'] || ''
      const parts = Object.fromEntries(
        header.split(',').map((p) => p.split('='))
      )
      const timestamp = parts['t']
      const receivedSig = parts['s']

      if (!timestamp || !receivedSig) {
        return res.status(400).json({ ok: false, error: 'Missing MoonPay-Signature-1 header' })
      }

      const expected = crypto
        .createHmac('sha256', moonpaySecret)
        .update(`${timestamp}.${rawBody}`)
        .digest('hex')

      if (expected !== receivedSig) {
        console.warn('[moonpay-webhook] invalid signature')
        return res.status(401).json({ ok: false, error: 'Invalid signature' })
      }
    }

    // 2. Parse payload
    const payload = JSON.parse(rawBody)
    console.log('[moonpay-webhook] received status:', payload?.transaction?.status)

    const { transaction } = payload
    if (!transaction) {
      return res.status(400).json({ ok: false, error: 'No transaction in payload' })
    }

    // Only act on completed transactions
    if (transaction.status !== 'completed') {
      return res.json({ ok: true, skipped: true, status: transaction.status })
    }

    const jarPubkeyStr = transaction.externalTransactionId
    const comment = (transaction.notes || '').slice(0, 120)
    // baseCurrencyAmount is in USD — store cents as u64 for now
    const amountUnits = Math.round((transaction.baseCurrencyAmount || 0) * 100)

    if (!jarPubkeyStr) {
      return res.status(400).json({ ok: false, error: 'externalTransactionId (jar pubkey) missing' })
    }
    if (amountUnits <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid amount' })
    }

    // 3. Call gift_deposit on-chain
    const jarPubkey = new PublicKey(jarPubkeyStr)
    const contributionKeypair = Keypair.generate()

    const txSignature = await program.methods
      .giftDeposit(new anchor.BN(amountUnits), comment)
      .accounts({
        jar: jarPubkey,
        contribution: contributionKeypair.publicKey,
        contributor: serverKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([contributionKeypair])
      .rpc()

    console.log('[moonpay-webhook] gift_deposit tx:', txSignature)
    res.json({ ok: true, txSignature })
  } catch (err) {
    console.error('[moonpay-webhook]', err.message)
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
