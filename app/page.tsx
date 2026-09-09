import Link from "next/link";
import { ArrowRight, Check, Database, Files, ShieldCheck, Sparkles } from "lucide-react";
import { Brand } from "@/components/brand";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "Northstar";

export default function HomePage() {
  return (
    <main className="landing">
      <nav className="site-nav">
        <Brand />
        <div className="nav-links"><Link href="#features">Features</Link><Link href="#security">Security</Link><Link href="#pricing">Pricing</Link></div>
        <div className="nav-actions"><Link href="/sign-in" className="button button-quiet">Sign in</Link><Link href="/register" className="button button-primary">Start free</Link></div>
      </nav>

      <section className="hero">
        <div>
          <span className="eyebrow">A clear place for useful work</span>
          <h1>Your team, in a better rhythm.</h1>
          <p>{appName} is a small, secure SaaS foundation for teams who want projects, files, people and billing to feel straightforward.</p>
          <div className="hero-actions"><Link href="/register" className="button button-dark">Create a workspace <ArrowRight size={16} /></Link><Link href="#features" className="button button-quiet">See how it works</Link></div>
        </div>
        <div className="hero-card">
          <div className="hero-card-head"><span>Workspace / ready</span><span>●</span></div>
          <h2>A calm operating system for the next thing.</h2>
          <p>Invite the right people, keep the latest files close, and make progress visible without adding process for its own sake.</p>
          <div className="hero-metrics"><div className="metric"><strong>01</strong><span>shared workspace</span></div><div className="metric"><strong>RBAC</strong><span>clear access</span></div><div className="metric"><strong>24/7</strong><span>your data</span></div></div>
        </div>
      </section>

      <section className="section" id="features">
        <div className="section-heading"><h2>Everything essential. Nothing noisy.</h2><p>Start with a strong foundation and add only the product logic your business actually needs.</p></div>
        <div className="feature-grid">
          <article className="feature"><span className="feature-icon"><Database size={19} /></span><h3>One workspace</h3><p>Projects and people share a tenant boundary, so every query starts from the right organisation.</p></article>
          <article className="feature"><span className="feature-icon"><Files size={19} /></span><h3>Files where they belong</h3><p>Send project files to a private Google Drive folder without exposing service credentials in the browser.</p></article>
          <article className="feature"><span className="feature-icon"><ShieldCheck size={19} /></span><h3>Access you can explain</h3><p>Owner, admin and member roles are enforced in server actions and API routes, not only in the UI.</p></article>
        </div>
      </section>

      <section className="section" id="security">
        <div className="two-column"><div className="panel"><span className="eyebrow">Security baseline</span><h2 style={{ margin: "18px 0 10px", fontSize: 34, letterSpacing: "-.06em" }}>Simple to audit. Safe to extend.</h2><p className="panel-subtitle">Auth.js sessions, bcrypt passwords, login lockout, server-side authorisation and private-by-default storage are included from day one.</p><ul className="check-list"><li>No database secrets in client code</li><li>Protected dashboard routes and API handlers</li><li>Webhook signatures checked before billing updates</li></ul></div><div className="panel"><span className="feature-icon"><Sparkles size={19} /></span><h3 style={{ marginTop: 26 }}>Bring your own stack</h3><p className="panel-subtitle">Use the included Supabase-compatible Docker database locally, connect a hosted Supabase Postgres instance in production, and keep providers replaceable.</p><Link href="/register" className="button button-dark">Open a workspace <ArrowRight size={16} /></Link></div></div>
      </section>

      <section className="section" id="pricing"><div className="section-heading"><h2>Start small. Grow when ready.</h2><p>Every workspace begins on the free plan. Billing is opt-in and handled by Stripe Checkout.</p></div><div className="feature-grid"><article className="feature"><span className="eyebrow">Free</span><h3>For finding the shape</h3><p>Projects, a small team and the full dashboard foundation.</p><div style={{ marginTop: 24 }}><Link href="/register" className="button button-quiet">Start free</Link></div></article><article className="feature" style={{ borderColor: "#a8c59f", background: "#e9f8df" }}><span className="eyebrow">Pro</span><h3>For doing the work</h3><p>Upgrade through Stripe when your workspace needs more capacity and support.</p><div style={{ marginTop: 24 }}><Link href="/register" className="button button-dark">Choose Pro</Link></div></article><article className="feature"><span className="eyebrow">Your product</span><h3>Make it yours</h3><p>Replace the sample project surface with your own domain model without changing the security boundary.</p><div style={{ marginTop: 24 }}><Link href="/sign-in" className="button button-quiet">Sign in</Link></div></article></div></section>

      <footer className="footer"><Brand /> <span style={{ float: "right" }}>A clean Next.js SaaS starter.</span></footer>
    </main>
  );
}
