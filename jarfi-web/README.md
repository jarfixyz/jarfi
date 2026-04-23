# 🏺 jarfi-web

Next.js 14 · Tailwind · Cloudflare Workers

Landing page, dashboard, and gift page for JAR.

---

## Pages

| Route | What it is |
|---|---|
| `/` | Landing — hero, interactive calculator, unlock types, scenarios, trust |
| `/dashboard` | App shell — jars, contributors, gift link, forecast (mock data) |
| `/gift/[slug]` | What contributors see when they tap the share link |
| `/api/moonpay-webhook` | Placeholder for MoonPay settlement callback |

All data is currently **mocked**. On-chain integration happens in Stage 2.

---

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000

---

## Deploy to Cloudflare Workers

First time only — log in:

```bash
npx wrangler login
```

Then any time you want to ship:

```bash
npm run deploy
```

This builds with `@cloudflare/next-on-pages` and publishes to the `jarfi-web`
Cloudflare Pages project. The URL is printed at the end.

---

## Stack

- Next.js 14 App Router
- Tailwind 3 + custom palette (Solana accents + pastel surfaces)
- Fraunces (display) + DM Sans (body) + JetBrains Mono
- Lucide icons
- `@cloudflare/next-on-pages` for deploy

---

## Next steps

- [ ] Stage 2: add `@solana/wallet-adapter-*`, Anchor client, real on-chain reads
- [ ] Stage 2: wire `/api/moonpay-webhook` to call `gift_deposit` on program
- [ ] Stage 2: replace mock JARS with PDA fetches
- [ ] Stage 3: DoubleZero RPC integration
