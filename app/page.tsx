import Link from "next/link";
import { ArrowRight, Box, ShieldCheck, Sparkles } from "lucide-react";
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
          <p>{appName} is an intentionally empty Next.js starting point. Keep the shell, authentication and access boundary; add only the product logic your team actually needs.</p>
          <div className="hero-actions"><Link href="/register" className="button button-dark">Create a workspace <ArrowRight size={16} /></Link><Link href="#features" className="button button-quiet">See the foundation</Link></div>
        </div>
        <div className="hero-card">
          <div className="hero-card-head"><span>Workspace / ready</span><span>●</span></div>
          <h2>A clean place to begin.</h2>
          <p>No fake data. No opinionated domain model. No hidden provider dependency.</p>
          <div className="hero-metrics"><div className="metric"><strong>01</strong><span>Next.js app</span></div><div className="metric"><strong>RBAC</strong><span>access boundary</span></div><div className="metric"><strong>0</strong><span>business rules</span></div></div>
        </div>
      </section>

      <section className="section" id="features">
        <div className="section-heading"><h2>Everything essential. Nothing noisy.</h2><p>Start with a strong foundation and add only the product logic your business actually needs.</p></div>
        <div className="feature-grid">
          <article className="feature"><span className="feature-icon"><ShieldCheck size={19} /></span><h3>Real authentication</h3><p>Credentials are hashed and protected routes are enforced on the server.</p></article>
          <article className="feature"><span className="feature-icon"><Box size={19} /></span><h3>Small surface</h3><p>Landing, sign-in, registration, dashboard and workspace settings are ready to extend.</p></article>
          <article className="feature"><span className="feature-icon"><ShieldCheck size={19} /></span><h3>Access you can explain</h3><p>Owner, admin and member roles are enforced in server actions and API routes, not only in the UI.</p></article>
        </div>
      </section>

      <section className="section" id="security"><div className="two-column"><div className="panel"><span className="eyebrow">Security baseline</span><h2 style={{ margin: "18px 0 10px", fontSize: 34, letterSpacing: "-.06em" }}>Simple to audit. Safe to extend.</h2><p className="panel-subtitle">Auth.js sessions, bcrypt passwords, login lockout and server-side workspace checks are included from day one.</p><ul className="check-list"><li>No database secrets in client code</li><li>Protected dashboard routes</li><li>Explicit owner/admin/member roles</li></ul></div><div className="panel"><span className="feature-icon"><Sparkles size={19} /></span><h3 style={{ marginTop: 26 }}>Add your domain</h3><p className="panel-subtitle">Use the included Supabase-compatible Docker database locally, then connect a hosted Supabase Postgres instance when ready.</p><Link href="/register" className="button button-dark">Open a workspace <ArrowRight size={16} /></Link></div></div></section>

      <section className="section" id="pricing"><div className="section-heading"><h2>Ready when you are.</h2><p>This branch is deliberately not a product. It is a clean starting point for one.</p></div><div className="feature-grid"><article className="feature"><span className="eyebrow">Included</span><h3>Real account</h3><p>Create a workspace owner and sign in with a real database-backed session.</p></article><article className="feature" style={{ borderColor: "#a8c59f", background: "#e9f8df" }}><span className="eyebrow">Included</span><h3>Role-ready</h3><p>The membership table is ready for your own feature permissions.</p></article><article className="feature"><span className="eyebrow">Next step</span><h3>Define the work</h3><p>Add your first business model and keep the rest of the shell intact.</p></article></div></section>

      <footer className="footer"><Brand /> <span style={{ float: "right" }}>A clean Next.js SaaS starter.</span></footer>
    </main>
  );
}
