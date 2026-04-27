# JAR — Master Checklist
> Last updated: 2026-04-27

---

## Smart Contract (`jarfi-contract`)
Program ID: `HtQt8P4pcF2X4D9oxWwsafj5KnwJsUPF148mvkZMQaFW` · Solana devnet

- [x] `create_jar` — mode 0/1/2, goal_amount, unlock_date, child_wallet
- [x] `deposit` — adds to balance
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

**Рішення: USDC як основний актив, SOL як опція**

Поточна проблема: контракт тримає SOL (lamports), але Transak відправляє USDC.
Після Transak webhook USDC лежить на адресі jar pubkey як SPL token — контракт його не бачить.

**Цільова архітектура:**
```
Transak (fiat → USDC) ──→ USDC SPL token vault
                                  ↓
                         Kamino deposit → kUSDC (7-9% APY)
                                  ↓
                         Jar зберігає kUSDC shares

SOL (альтернатива) ──→ Marinade → mSOL (6.85% APY)
                              ↓
                         Jar зберігає mSOL shares
```

**При виводі:**
- kUSDC → USDC (Kamino redeem)
- mSOL → SOL (Marinade unstake або instant via Jupiter)

---

## ФАЗА 1 — USDC Foundation (критично для продакшн)
> Переписати контракт під реальні активи

### 1.1 Contract: USDC SPL token vault
- [ ] Додати `usdc_vault` — Associated Token Account (ATA) для кожного jar
- [ ] `deposit_usdc(amount)` — переказ USDC з гаманця юзера → jar vault
- [ ] `gift_deposit_usdc(amount, comment)` — те саме для подарунків
- [ ] `withdraw_usdc(amount)` — власник виводить USDC (при unlock)
- [ ] `usdc_balance` поле в Jar акаунті
- [ ] Зберегти SOL mode як `jar_type: 0=usdc | 1=sol` (двоїстість)
- [ ] Нові тести: ~10 додаткових

### 1.2 Backend: реальний USDC flow після Transak
- [ ] Після `ORDER_COMPLETED` — перевірити що USDC справді прилетів (getTokenAccountBalance)
- [ ] Викликати `deposit_usdc` замість `gift_deposit` (або обидва)
- [ ] Логувати crypto_amount (USDC) з Transak payload

### 1.3 Web: відображати USDC balance
- [ ] Dashboard: показувати баланс в USDC ($) а не в SOL
- [ ] Jar card: `$124.50 USDC` замість `0.5 SOL`
- [ ] Конвертація в USD через CoinGecko/Pyth для SOL mode

---

## ФАЗА 2 — Kamino стейкінг (yield на USDC)

### 2.1 Contract: Kamino CPI
- [ ] Додати Kamino як залежність (програма `KLend2g3cZ51Uezwx6SCXEH2ow1LiRJQekhU1f6aB5U`)
- [ ] `stake_usdc_kamino()` — після deposit_usdc автоматично стейкати в Kamino vault
- [ ] `unstake_usdc_kamino()` — при withdraw_usdc забрати з Kamino
- [ ] `kamino_shares` поле в Jar (замість staking_shares)
- [ ] Розраховувати реальний yield при виводі

### 2.2 Backend: Kamino APY
- [ ] Endpoint `GET /apy` → повертає Kamino USDC APY (live) + Marinade SOL APY
- [ ] Fallback на hardcoded якщо API недоступне

### 2.3 Web: Kamino APY відображення
- [ ] Замінити hardcoded 6.85% → live Kamino APY
- [ ] Показати earned yield в dashboard ("Earned: +$12.40")

---

## ФАЗА 3 — Recurring Deposits (автовнески)
> Юзер встановлює розклад поповнення банки зі свого гаманця

### 3.1 Backend: schedule engine
- [ ] Schema: `schedules` — `{id, jar_pubkey, owner_pubkey, amount_usdc, cron_expr, push_subscription, last_sent, active}`
- [ ] `POST /schedule/create` — зберегти розклад
- [ ] `GET /schedule/:owner` — список розкладів
- [ ] `DELETE /schedule/:id` — скасувати
- [ ] Cron runner: кожну хвилину перевіряти які schedules готові → слати web push
- [ ] `POST /push/subscribe` — зберегти browser push subscription (endpoint + keys)

### 3.2 Web push notifications
- [ ] Згенерувати VAPID ключі → додати в Railway env vars
  - `VAPID_PUBLIC_KEY`
  - `VAPID_PRIVATE_KEY`
  - `VAPID_EMAIL`
- [ ] `public/sw.js` — service worker: обробляє push event, показує notification
- [ ] При першому відкритті dashboard: запросити дозвіл на сповіщення
- [ ] Зареєструвати push subscription → POST /push/subscribe

### 3.3 Web UI: recurring deposit в create jar modal
- [ ] Toggle "Автоматичний внесок"
- [ ] Поля: сума ($), частота (щодня / щотижня / щомісяця), день, час
- [ ] При збереженні: POST /schedule/create
- [ ] Dashboard: секція "Мої розклади" — список активних автовнесків
- [ ] Confirmation flow: push → юзер відкриває сайт → wallet pop-up → підпис

---

## ФАЗА 4 — Group Trip Jar (новий use case)
> Подруги збираються в Париж. Одна організатор — збирає кошти з усіх, сама витрачає.

**Різниця від поточного gift jar:**
- Поточний: гроші заблоковані до unlock_date, тільки child_wallet виводить
- Group trip: організатор має доступ ЗАРАЗ, може витрачати progressively

### 4.1 Contract: `group_jar` mode
- [ ] Новий тип jar: `jar_type = 2` (group / travel fund)
- [ ] `organizer` = власник, може withdraw в будь-який час до goal
- [ ] `partial_withdraw(amount)` — вивести частину (для оплати готелю тощо)
- [ ] `close_jar()` — розпустити jar після поїздки, повернути залишок контрибуторам (опційно)
- [ ] Зберегти contributors list + їх суми (для повернення)

### 4.2 Gift page: Group Trip варіант
- [ ] Новий шаблон gift page: "Trip to Paris 🗼"
- [ ] Показує прогрес: "Зібрано $840 з $1200"
- [ ] Список учасників з аватарами
- [ ] Кнопка "Надіслати" → Transak (будь-яка країна, будь-яка валюта → USDC)
- [ ] Після оплати: "Дякую! Ти частина подорожі ✈️"

### 4.3 Create jar: Group Trip шаблон
- [ ] В modal: вибір типу "Savings jar" / "Group fund" / "Gift jar"
- [ ] Group fund: поля — назва, мета (сума), опис, дедлайн збору
- [ ] Авто-генерується share link

### 4.4 Dashboard: Organizer view
- [ ] Кнопка "Вивести кошти" активна одразу
- [ ] Показує хто скільки надіслав
- [ ] Transaction history: витрати організатора

---

## ФАЗА 5 — Spending (витрачання USDC)
> Після збору — як реально витратити?

- [ ] **Solana Pay QR** — організатор показує QR у магазині → оплата з jar vault
- [ ] **Withdraw to bank** — через Transak offramp (USDC → EUR/UAH на карту)
- [ ] **Virtual card** — інтеграція Avici або Kast (USDC debit card)
- [ ] **Direct transfer** — withdraw_usdc → будь-який гаманець → обмінник

---

## ФАЗА 6 — Mainnet & Polish
- [ ] OtterSec аудит контракту
- [ ] Mainnet deploy
- [ ] Multisig для group jars (Squads Protocol)
- [ ] KYC для великих сум (Sumsub або Synaps)
- [ ] App Store / Play Store (React Native)

---

## Priority queue
```
1. ✅ MVP hackathon done

── POST-HACKATHON ──────────────────────────────────
2. [ ] Фаза 1 — USDC Foundation (contract rewrite)
       → без цього Transak гроші реально не в контракті

3. [ ] Фаза 3 — Recurring Deposits (backend + push + UI)
       → окрема фіча, не залежить від USDC rewrite

4. [ ] Фаза 2 — Kamino стейкінг (після USDC Foundation)

5. [ ] Фаза 4 — Group Trip Jar (новий use case)
       → залежить від USDC Foundation + partial_withdraw

6. [ ] Фаза 5 — Spending (Solana Pay / offramp / card)

7. [ ] Фаза 6 — Mainnet & Polish
```
