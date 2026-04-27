# JAR — Master Checklist
> Last updated: 2026-04-27

---

## Smart Contract (`jarfi-contract`)
Program ID: `HtQt8P4pcF2X4D9oxWwsafj5KnwJsUPF148mvkZMQaFW` · Solana devnet

- [x] `create_jar` — mode 0/1/2, goal_amount, unlock_date, child_wallet
- [x] `deposit` — adds to balance (SOL/lamports)
- [x] `gift_deposit` — stores Contribution account (jar, contributor, amount, comment)
- [x] `unlock_jar` — mode 0 (date), mode 1 (goal), mode 2 (either/first)
- [x] `emergency_withdraw` — owner bypasses all conditions
- [x] 14 tests passing
- [ ] **Marinade CPI** — staking_shares is a mock, no real Marinade calls
- [ ] **Multisig** — not in contract

---

## Backend (`jarfi-backend`)
Node.js / Express · `https://jarfi.up.railway.app`

- [x] `POST /jar/create` → on-chain createJar
- [x] `GET /jar/:pubkey` → fetch Jar + Contributions from devnet
- [x] `POST /transak-webhook` → JWT verify → gift_deposit on-chain
- [x] **Deployed on Railway** — auto-deploys from `main` branch (`jarfi-backend/` root)
- [x] `NEXT_PUBLIC_BACKEND_URL` = `https://jarfi.up.railway.app` → set in Cloudflare Pages ✅
- [x] **`TRANSAK_API_SECRET`** → set in Railway env vars ✅

---

## Web (`jarfi-web`)
Next.js 15 · Live at jarfi.xyz · Cloudflare Pages

- [x] Landing page
- [x] Dashboard — wallet connect (Phantom, Solflare)
- [x] Live jar fetches by owner wallet (PDA reads via Anchor)
- [x] Create jar modal → browser wallet signs `createJar`
- [x] Gift page — `jarfi.xyz/gift/[slug]` — Transak widget (card/Apple Pay → USDC on Solana)
- [x] Gift page reads real jar data from on-chain when slug is a Solana pubkey
- [x] Contributors / activity feed (live Contribution account fetches)
- [x] Deployed at jarfi.xyz with git auto-deploy (Cloudflare Pages)
- [x] `NEXT_PUBLIC_BACKEND_URL` = `https://jarfi.up.railway.app` → set in Cloudflare Pages ✅
- [x] `NEXT_PUBLIC_TRANSAK_API_KEY` → set in Cloudflare Pages ✅
- [x] `NEXT_PUBLIC_ENV` = `staging` → set in Cloudflare Pages ✅
- [x] Marinade APY — real from API (6.85%), gift page fetches live
- [ ] **Push notifications** — not started

---

## Mobile (`jarfi-mobile`)
> ❌ Out of hackathon scope — skipped

---

## DoubleZero RPC
> Mention only — add "Powered by DoubleZero" to README, no code changes needed

---

---

# BACKLOG — Post-hackathon roadmap

---

## АРХІТЕКТУРНЕ РІШЕННЯ: SOL vs USDC

**Рішення затверджено:**
- **USDC = основний актив** (Transak завжди доставляє USDC, люди розуміють $)
- **SOL = опціональний режим** — юзер вибирає при створенні банки (один раз, незмінно)
- **Yield USDC** → Kamino Lend (~7–9% APY) через backend SDK
- **Yield SOL** → Marinade (~6.85% APY) — залишається як є (мок поки)
- **Swap** → Jupiter Terminal вбудований виджет у dashboard

### Технічний стек для yield (результат ресерчу)

```
Kamino Lend
  Program ID: KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD (mainnet = devnet ✅)
  TypeScript SDK: @kamino-finance/klend-sdk
  Rust CPI crate: kamino-lend (Anchor ≥0.30.1)
  Підхід: backend SDK (простіше) → не CPI з контракту

Jupiter Terminal
  NPM: @jup-ag/terminal
  Версія: 4.x
  Інтеграція: React компонент в Next.js dashboard
```

### Флоу USDC банки (end-to-end)

```
[Donor] → Transak widget → USDC on Solana → backend wallet
                                                    ↓
                                        deposit_usdc() on-chain
                                        (контракт: USDC → jar ATA)
                                                    ↓
                                    backend: @kamino-finance/klend-sdk
                                    depositToKamino(jar_pubkey, amount)
                                                    ↓
                                    Kamino: USDC → kUSDC shares
                                    зберігаються в jar.kamino_obligation

[Owner] withdraw_usdc() →
    backend: redeemFromKamino() → USDC + accrued yield → owner wallet
```

### Флоу SOL банки (end-to-end)

```
[Donor] → Transak widget → USDC → backend wallet
                                        ↓
                          Jupiter swap: USDC → SOL (backend)
                                        ↓
                          deposit() on-chain (lamports)
                          [Marinade CPI — todo]

[Owner direct] → Phantom → deposit SOL directly
```

---

## ФАЗА 1 — USDC Foundation
> Мета: USDC реально живе в контракті. Без стейкінгу поки.
> Оцінка: ~3 дні

### 1A — Contract: USDC vault
- [ ] Додати `jar_currency: u8` (0=USDC, 1=SOL) у Jar struct
- [ ] Додати `usdc_balance: u64` (6 decimals, USDC)
- [ ] Додати `usdc_vault: Pubkey` — ATA адреса USDC vault для цієї банки
- [ ] Інструкція `create_jar` — якщо USDC mode: ініціалізувати ATA (`usdc_vault`)
- [ ] Інструкція `deposit_usdc(amount: u64)` — transfer USDC з signer → jar ATA, update `usdc_balance`
- [ ] Інструкція `withdraw_usdc(amount: u64)` — transfer USDC з jar ATA → owner, перевірити unlock умови
- [ ] Інструкція `gift_deposit_usdc(amount, comment)` — transfer USDC, записати Contribution
- [ ] USDC mint: devnet = `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`, mainnet = `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- [ ] Нові тести: deposit_usdc, withdraw_usdc, gift_deposit_usdc (~8 тестів)

### 1B — Backend: USDC deposit flow
- [ ] Після `ORDER_COMPLETED` в transak-webhook: викликати `depositUsdc()` замість `giftDeposit()`
- [ ] Читати `cryptoAmount` з Transak payload (реальна кількість USDC)
- [ ] Якщо jar is SOL mode: Jupiter swap USDC→SOL перед deposit
  - `npm install @jup-ag/api` 
  - `POST https://quote-api.jup.ag/v6/quote` → `POST /swap`
- [ ] `GET /jar/:pubkey` — додати `usdc_balance` і `jar_currency` у відповідь
- [ ] `POST /jar/create` — приймати `currency: "usdc" | "sol"` параметр

### 1C — Web: відображення USDC
- [ ] Dashboard jar card: показувати `$124.50` якщо USDC, `◎ 0.5` якщо SOL
- [ ] Create jar modal: додати вибір валюти (USDC / SOL toggle)
  - USDC: "Стабільно. ~7–9% APY. Ідеально для цілей."
  - SOL: "Для тих хто вірить в SOL. ~6.85% APY."
- [ ] Stat cards в dashboard: баланс в USD (не SOL)
- [ ] Gift page: "Funds earn ~X% APY" — різний текст залежно від jar_currency
- [ ] Landing page: оновити секцію порівняння (вже є, дрібні правки)

---

## ФАЗА 2 — Kamino стейкінг (yield на USDC)
> Мета: USDC в банці автоматично стейкується в Kamino і заробляє %.
> Оцінка: ~2 дні
> Залежить від: Фаза 1

### 2A — Backend: Kamino SDK інтеграція
- [ ] `npm install @kamino-finance/klend-sdk`
- [ ] `kaminoService.js` — клас з методами:
  - `depositToKamino(jarPubkey, usdcAmount)` → returns obligation pubkey
  - `redeemFromKamino(jarPubkey, shares)` → returns USDC amount
  - `getKaminoBalance(jarPubkey)` → USDC + accrued yield
- [ ] Камino lending market на devnet: `7u3HeL2whDHnTbDpWWyBCFTbFhxHiAg9XHVqMUNsE4s7` (потребує верифікації)
- [ ] Після кожного `deposit_usdc` → auto `depositToKamino()`
- [ ] Зберігати `obligation_pubkey` per jar (в пам'яті або SQLite файл)
- [ ] `GET /jar/:pubkey` — додати `kamino_yield_earned: number` у відповідь

### 2B — Contract: зберігати Kamino obligation
- [ ] Додати `kamino_obligation: Pubkey` у Jar struct (де лежать kUSDC shares)
- [ ] `set_kamino_obligation(pubkey)` — backend-only інструкція для запису

### 2C — Backend: live APY endpoint
- [ ] `GET /apy` → `{ usdc_kamino: 8.2, sol_marinade: 6.85 }`
- [ ] Читати Kamino APY: `GET https://api.kamino.finance/strategies/usdc/apy`
- [ ] Fallback: hardcoded якщо API недоступне

### 2D — Web: Kamino yield відображення
- [ ] Dashboard: "Earned: +$12.40" під балансом банки
- [ ] Stat card: "Staking earned" — реальна цифра з Kamino
- [ ] APY badge: замінити hardcoded 6.85% → live Kamino APY з `GET /apy`
- [ ] Tooltip: "Yield from Kamino · updated daily"

---

## ФАЗА 3 — Jupiter Terminal (swap виджет)
> Мета: юзер може свапати прямо в dashboard.
> Оцінка: ~0.5 дня

### 3A — Web: Jupiter Terminal вбудований
- [ ] `npm install @jup-ag/terminal`
- [ ] `components/JupiterSwap.tsx` — обгортка над Jupiter Terminal
- [ ] Відкривається як modal при кліку "Конвертувати"
- [ ] Дефолтний input: USDC, output: SOL (або навпаки залежно від jar_currency)
- [ ] Передати `passThroughWallet` — підключений Phantom гаманець
- [ ] Після свапу — пропонувати "Депозитити в банку?"

```tsx
// Приклад ініціалізації
import { init } from "@jup-ag/terminal";

init({
  displayMode: "modal",
  integratedTargetId: "jupiter-swap",
  defaultExplorer: "Solscan",
  formProps: {
    initialInputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
    initialOutputMint: "So11111111111111111111111111111111111111112",  // SOL
  },
});
```

---

## ФАЗА 4 — Recurring Deposits (автовнески)
> Мета: юзер ставить розклад поповнення, отримує push і підтверджує.
> Оцінка: ~2 дні

### 4A — Backend: schedule engine
- [ ] `schedules.json` або SQLite (better-sqlite3) для зберігання
- [ ] Schema: `{ id, jar_pubkey, owner_pubkey, amount_usdc, cron_expr, push_subscription, last_fired, active }`
- [ ] `POST /schedule/create` — зберегти розклад
- [ ] `GET /schedule/:owner_pubkey` — список активних розкладів
- [ ] `DELETE /schedule/:id` — скасувати
- [ ] Cron runner (node-cron): кожну хвилину перевіряє schedules → шле web push
- [ ] `POST /push/subscribe` — зберегти browser push subscription

### 4B — Backend: VAPID web push
- [ ] `npm install web-push node-cron`
- [ ] Згенерувати VAPID ключі: `npx web-push generate-vapid-keys`
- [ ] Додати в Railway env vars: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`
- [ ] Push payload: `{ title: "Час поповнити банку", body: "$100 → Паризька подорож", jar: pubkey, amount: 100 }`

### 4C — Web: service worker + push permission
- [ ] `public/sw.js` — service worker
  - `push` event: показати notification з кнопками "Підтвердити" / "Пізніше"
  - `notificationclick`: відкрити `/dashboard?confirm=jar_pubkey&amount=100`
- [ ] `lib/push.ts` — `subscribeToPush()`, `POST /push/subscribe`
- [ ] Dashboard: при першому відкритті → запросити дозвіл на сповіщення
- [ ] URL `/dashboard?confirm=...` — автоматично відкриває wallet pop-up для підпису

### 4D — Web UI: recurring deposit в create jar modal
- [ ] Toggle "Регулярний внесок від мене"
- [ ] Поля: сума ($), частота (щотижня / щомісяця), день (1-28), час (HH:MM)
- [ ] Preview: "Буду відкладати $100 кожного 5-го числа о 10:00"
- [ ] При save: `POST /schedule/create`
- [ ] Dashboard → "Мої автовнески": список, кнопка "Зупинити"

---

## ФАЗА 5 — Group Trip Jar
> Мета: подруги збирають на Париж, одна організатор — витрачає одразу.
> Оцінка: ~3 дні
> Завжди USDC (стейблкоїн = ідеально для подорожей)

### 5A — Contract: `group_jar` mode
- [ ] `jar_type: u8` — 0=savings, 1=group_trip
- [ ] Group trip: немає unlock_date / goal умов — організатор виводить в будь-який час
- [ ] `partial_withdraw_usdc(amount)` — вивести частину (готель, квитки)
- [ ] `close_group_jar()` — розпустити, повернути залишок контрибуторам пропорційно
- [ ] Contributors map: зберігати `(contributor_pubkey → amount)` для можливого повернення

### 5B — Gift page: Group Trip варіант
- [ ] Detect `jar_type == 1` → інший шаблон: "Trip to Paris 🗼"
- [ ] Прогрес-бар: "Зібрано $840 з $1200"
- [ ] Список учасників з аватарами (Dicebear генерація по pubkey)
- [ ] Після оплати: анімація "Ти частина подорожі ✈️"

### 5C — Create jar: Group Trip шаблон
- [ ] В modal: вибір типу "Savings" / "Group fund" / "Gift jar"
- [ ] Group fund поля: назва, ціль ($), дедлайн збору, опис
- [ ] Завжди USDC mode (фіксовано для group)
- [ ] Авто-генерується share link

### 5D — Dashboard: Organizer view
- [ ] "Вивести кошти" кнопка — активна одразу (partial_withdraw_usdc)
- [ ] Хто скільки надіслав (contributions list)
- [ ] Витрати організатора (withdraw history)

---

## ФАЗА 6 — Spending
- [ ] Solana Pay QR — платежі з jar прямо в магазині
- [ ] Transak offramp — USDC → EUR/UAH на картку
- [ ] Virtual card — Avici або Kast (USDC debit)

---

## ФАЗА 7 — Mainnet & Polish
- [ ] OtterSec аудит
- [ ] Mainnet deploy
- [ ] Multisig (Squads Protocol) для group jars
- [ ] KYC (Sumsub) для великих сум
- [ ] App Store / Play Store

---

## Priority queue
```
── ЗРОБЛЕНО ─────────────────────────────────────────
✅ MVP hackathon (контракт + backend + web + Transak)
✅ TRANSAK_API_SECRET → Railway

── НАСТУПНІ КРОКИ ───────────────────────────────────
1. Фаза 1A → Contract: USDC vault (deposit_usdc / withdraw_usdc)
2. Фаза 1B → Backend: Transak webhook → deposit_usdc + Jupiter swap для SOL jars
3. Фаза 1C → Web: USDC баланс, вибір валюти при створенні
4. Фаза 3  → Jupiter Terminal widget (швидко, ~4 години)
5. Фаза 2  → Kamino стейкінг (після USDC foundation)
6. Фаза 4  → Recurring Deposits
7. Фаза 5  → Group Trip Jar
8. Фаза 6  → Spending
9. Фаза 7  → Mainnet + аудит
```
