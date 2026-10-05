import Link from "next/link";
import { ArrowRight, CreditCard, Files, ShieldCheck, Sparkles } from "lucide-react";
import { Brand } from "@/components/brand";
import { appName } from "@/lib/site";

// Placeholder marketing page: replace the copy below with your product's story.
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
          <span className="eyebrow">Your tagline goes here</span>
          <h1>Describe what your product does.</h1>
          <p>{appName} gives every customer a secure workspace with team roles, billing and file storage. Add your product on top.</p>
          <div className="hero-actions"><Link href="/register" className="button button-dark">Create a workspace <ArrowRight size={16} /></Link><Link href="#features" className="button button-quiet">See what&apos;s included</Link></div>
        </div>
        <div className="hero-card">
          <div className="hero-card-head"><span>Workspace / ready</span><span>●</span></div>
          <h2>Show your product here.</h2>
          <p>Use this card for a screenshot, a short demo or the key outcome your customers get.</p>
          <div className="hero-metrics"><div className="metric"><strong>Teams</strong><span>shared workspaces</span></div><div className="metric"><strong>RBAC</strong><span>owner / admin / member</span></div><div className="metric"><strong>Billing</strong><span>Stripe subscriptions</span></div></div>
        </div>
      </section>

      <section className="section" id="features">
        <div className="section-heading"><h2>What&apos;s included.</h2><p>The common SaaS plumbing is done, so your time goes into the product itself.</p></div>
        <div className="feature-grid">
          <article className="feature"><span className="feature-icon"><ShieldCheck size={19} /></span><h3>Workspaces and roles</h3><p>Every record belongs to a workspace, and owner, admin and member roles are enforced on the server.</p></article>
          <article className="feature"><span className="feature-icon"><CreditCard size={19} /></span><h3>Subscription billing</h3><p>Stripe Checkout and signature-verified webhooks keep each workspace&apos;s plan in sync.</p></article>
          <article className="feature"><span className="feature-icon"><Files size={19} /></span><h3>Private file storage</h3><p>Uploads go to a private Google Drive folder without exposing service credentials to the browser.</p></article>
        </div>
      </section>

      <section className="section" id="security">
        <div className="two-column"><div className="panel"><span className="eyebrow">Security baseline</span><h2 style={{ margin: "18px 0 10px", fontSize: 34, letterSpacing: "-.06em" }}>Secure by default.</h2><p className="panel-subtitle">Auth.js sessions, bcrypt passwords, login lockout, server-side authorisation and private-by-default storage are included from day one.</p><ul className="check-list"><li>No database secrets in client code</li><li>Protected dashboard routes and API handlers</li><li>Webhook signatures checked before billing updates</li></ul></div><div className="panel"><span className="feature-icon"><Sparkles size={19} /></span><h3 style={{ marginTop: 26 }}>Bring your own stack</h3><p className="panel-subtitle">Use the included Supabase-compatible Docker database locally, connect a hosted Supabase Postgres instance in production, and keep providers replaceable.</p><Link href="/register" className="button button-dark">Open a workspace <ArrowRight size={16} /></Link></div></div>
      </section>

      <section className="section" id="pricing"><div className="section-heading"><h2>Pricing.</h2><p>Every workspace starts on the free plan. Upgrades go through Stripe Checkout.</p></div><div className="feature-grid"><article className="feature"><span className="eyebrow">Free</span><h3>Describe the free plan</h3><p>List what free workspaces can do.</p><div style={{ marginTop: 24 }}><Link href="/register" className="button button-quiet">Start free</Link></div></article><article className="feature" style={{ borderColor: "#a8c59f", background: "#e9f8df" }}><span className="eyebrow">Pro</span><h3>Describe the paid plan</h3><p>List what upgrading unlocks.</p><div style={{ marginTop: 24 }}><Link href="/register" className="button button-dark">Choose Pro</Link></div></article><article className="feature"><span className="eyebrow">Custom</span><h3>Add more tiers as needed</h3><p>Create extra Stripe prices and add them to the Plan enum.</p><div style={{ marginTop: 24 }}><Link href="/sign-in" className="button button-quiet">Sign in</Link></div></article></div></section>

      <footer className="footer"><Brand /> <span style={{ float: "right" }}>© {appName}</span></footer>
    </main>
  );
}
