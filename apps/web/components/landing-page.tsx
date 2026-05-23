import Link from "next/link";
import "./landing-page.css";
import { Calculator } from "./landing/calculator";
import { JarTypesGrid } from "./landing/jar-types-grid";
import { ShareDemo } from "./landing/share-demo";
import { PaymentBlock } from "./landing/payment-block";
import { RemindersBlock } from "./landing/reminders-block";
import { FaqBlock } from "./landing/faq-block";

export function LandingPage() {
  return (
    <div className="jarfi-landing" data-theme="ink" data-bg="paper" data-font="grotesk">
      <div className="lp">
        <div className="nav">
          <Link href="/" className="nav-logo">
            jarfi
          </Link>
          <nav className="nav-links">
            <a href="#how">How it works</a>
            <a href="#cases">Use cases</a>
            <a href="#faq">FAQ</a>
            <Link href="/dashboard">Dashboard</Link>
          </nav>
          <Link href="/create" className="nav-btn">
            Create a jar
          </Link>
        </div>

        <section className="hero">
          <h1>
            Save for anything.
            <br />
            <em>Let it grow on its own.</em>
          </h1>
          <p className="hero-body">
            Set a goal. Share a link. Friends top it up with a bank card — no
            wallets, no seed phrases. Your money stakes itself and unlocks the
            day you hit the number.
          </p>
          <div className="hero-actions">
            <Link href="/create" className="btn-main">
              Start your jar
            </Link>
            <a href="#contrib" className="btn-ghost">
              See it live
            </a>
          </div>
        </section>

        <JarTypesGrid />
        <div className="divider" />
        <ShareDemo />
        <div className="divider" />
        <PaymentBlock />
        <div className="divider" />
        <RemindersBlock />
        <div className="divider" />

        <section className="calc-sec" id="how">
          <div className="two-col">
            <div className="col-text">
              <h2>$50 a month. 18 years. Double the money.</h2>
              <p>
                Your bank gives you <strong>~$10,800</strong>. The same $50 in
                jarfi — <strong>over $21,400</strong>.
              </p>
              <p>
                That&apos;s ~5.4% APY from Kamino USDC lending. Your money works
                while you don&apos;t.
              </p>
              <p className="micro">
                Projection, not a promise. Not financial advice.
              </p>
            </div>
            <Calculator />
          </div>
        </section>

        <div className="divider" />

        <FaqBlock />

        <div className="divider" />

        <section className="cta-sec">
          <div className="cta-card">
            <div className="cta-text">
              <h2>
                Your jar. <em>One minute</em> away.
              </h2>
              <p>Name it. Set a goal. Share the link.</p>
            </div>
            <Link href="/create" className="cta-btn">
              Start your jar
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </section>

        <footer>
          <span className="ft-logo">jarfi</span>
          <div className="ft-links">
            <a href="#">GitHub</a>
            <a href="#">Docs</a>
            <a href="#">Twitter</a>
          </div>
          <span className="ft-note">jarfi.xyz</span>
        </footer>
      </div>
    </div>
  );
}
