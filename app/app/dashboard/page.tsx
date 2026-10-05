import Link from "next/link";
import { ArrowUpRight, CreditCard, HardDrive, Users } from "lucide-react";
import { getDashboardData } from "@/actions/workspace";

export const metadata = { title: "Overview" };

export default async function DashboardPage() {
  const data = await getDashboardData();
  return <div>
    <div className="content-header"><div><span className="eyebrow">{data.organization.name}</span><h2>Overview.</h2><p>Your workspace at a glance. Replace this page with your product&apos;s home screen.</p></div><Link href="/app/team" className="button button-dark">Invite teammates <ArrowUpRight size={16} /></Link></div>
    <div className="stats-grid">
      <div className="stat-card"><span>Files</span><strong>{data.stats.assets}</strong></div>
      <div className="stat-card"><span>Members</span><strong>{data.stats.members}</strong></div>
      <div className="stat-card"><span>Plan</span><strong style={{ fontSize: 24 }}>{data.stats.plan}</strong></div>
    </div>
    <div className="card-grid">
      <section className="panel"><h3>Recent files</h3><p className="panel-subtitle">The latest uploads in this workspace.</p>{data.recentAssets.length ? <div className="list">{data.recentAssets.map((asset) => <div className="list-row" key={asset.id}><div><strong>{asset.name}</strong><span>Uploaded {asset.createdAt.toLocaleDateString()}</span></div><span className="pill">{(asset.size / 1024).toFixed(1)} KB</span></div>)}</div> : <div className="empty-state"><strong>No files yet.</strong><Link href="/app/files" style={{ color: "var(--accent-dark)", fontWeight: 700 }}>Upload a file →</Link></div>}</section>
      <section className="panel"><h3>Workspace foundation</h3><p className="panel-subtitle">Built-in pieces your product can build on.</p><div className="list"><div className="list-row"><div><strong><Users size={15} style={{ verticalAlign: "-2px", marginRight: 7 }} />Role controls</strong><span>Owner / admin / member</span></div><span className="pill">Ready</span></div><div className="list-row"><div><strong><CreditCard size={15} style={{ verticalAlign: "-2px", marginRight: 7 }} />Billing</strong><span>Stripe Checkout and webhooks</span></div><span className="pill">Ready</span></div><div className="list-row"><div><strong><HardDrive size={15} style={{ verticalAlign: "-2px", marginRight: 7 }} />File uploads</strong><span>Private server route</span></div><span className="pill">Ready</span></div></div><Link href="/app/settings" className="button button-quiet" style={{ marginTop: 18 }}>Review settings</Link></section>
    </div>
  </div>;
}
