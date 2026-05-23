const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "Do my friends need a crypto wallet to contribute?",
    a: "No. They open the link, tap Contribute, and pay with a bank card. No wallet, no signup, no seed phrase. Stablecoin conversion happens behind the scenes.",
  },
  {
    q: "Where does the yield come from?",
    a: "Idle USDC in your jar is lent on Kamino at roughly 5% APY. SOL jars can be staked via Marinade. Rates float with the market — we show the live number on every jar.",
  },
  {
    q: "Is the money safe? Can jarfi touch it?",
    a: "No. Funds sit in a Solana smart contract that only your wallet — or the unlock date you set — can release. We don’t custody anything and can’t move funds.",
  },
  {
    q: "What if I never reach the goal?",
    a: "Flexible jars let you withdraw what’s in them any time. Time-locked jars wait until the date you picked; if you cancel one, every contributor gets a refund of their share.",
  },
  {
    q: "What fees does jarfi take?",
    a: "Zero from jarfi itself. The only cost is the card processor’s fee on card top-ups (a few percent, shown before payment) and a tiny Solana network fee on wallet contributions.",
  },
  {
    q: "Which network is this on?",
    a: "Solana. Non-custodial, on-chain, verifiable. USDC is the canonical mainnet mint; SOL jars stake natively.",
  },
  {
    q: "Can I see who contributed?",
    a: "Yes — the jar page shows a live feed with each contributor’s name (or pseudonym) and amount. You can hide the list per-jar if you’d rather keep it private.",
  },
];

export function FaqBlock() {
  return (
    <section className="faq-sec" id="faq">
      <div className="faq-head-row">
        <span className="faq-eyebrow">FAQ</span>
        <h2 className="faq-title">
          Quiet questions, <em>plain</em> answers.
        </h2>
      </div>

      <ul className="faq-list">
        {FAQ_ITEMS.map((item) => (
          <li key={item.q} className="faq-item">
            <details>
              <summary>
                <span className="faq-q">{item.q}</span>
                <span className="faq-mark" aria-hidden />
              </summary>
              <p className="faq-a">{item.a}</p>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
