import { ArrowUpRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { getWorkspaceSettings } from "@/actions/workspace";

export const metadata = { title: "Overview" };

export default async function DashboardPage() {
  const data = await getWorkspaceSettings();
  return <div><div className="content-header"><div><span className="eyebrow">{data.organization.name}</span><h2>Your starting point.</h2><p>This branch intentionally contains no product-specific business logic.</p></div><Link href="/app/settings" className="button button-dark">Workspace settings <ArrowUpRight size={16} /></Link></div><div className="card-grid"><section className="panel"><span className="feature-icon"><ShieldCheck size={19} /></span><h3 style={{ marginTop: 24 }}>Foundation ready</h3><p className="panel-subtitle">Authentication, tenant membership and protected navigation are in place. Add your domain models one small slice at a time.</p><ul className="check-list"><li>Real credentials login</li><li>Owner, admin and member roles</li><li>PostgreSQL-compatible persistence</li></ul></section><section className="panel"><h3>Nothing to maintain yet</h3><p className="panel-subtitle">There are no sample projects, files, billing plans or provider-specific workflows in this starter.</p><div className="empty-state"><strong>Bring your own product.</strong>Replace this card with your first use case.</div></section></div></div>;
}
