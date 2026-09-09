import Link from "next/link";
import { ArrowUpRight, FolderKanban, HardDrive, Users } from "lucide-react";
import { getDashboardData } from "@/actions/workspace";

export const metadata = { title: "Overview" };

export default async function DashboardPage() {
  const data = await getDashboardData();
  return <div>
    <div className="content-header"><div><span className="eyebrow">{data.organization.name}</span><h2>Keep the work moving.</h2><p>A useful overview of your workspace, without the noise.</p></div><Link href="/app/projects/new" className="button button-dark">New project <ArrowUpRight size={16} /></Link></div>
    <div className="stats-grid">
      <div className="stat-card"><span>Projects</span><strong>{data.stats.projects}</strong></div>
      <div className="stat-card"><span>Files</span><strong>{data.stats.assets}</strong></div>
      <div className="stat-card"><span>Members</span><strong>{data.stats.members}</strong></div>
      <div className="stat-card"><span>Plan</span><strong style={{ fontSize: 24 }}>{data.stats.plan}</strong></div>
    </div>
    <div className="card-grid">
      <section className="panel"><h3>Recent projects</h3><p className="panel-subtitle">The latest places your team has been working.</p>{data.recentProjects.length ? <div className="list">{data.recentProjects.map((project) => <div className="list-row" key={project.id}><div><strong>{project.name}</strong><span>Updated {project.updatedAt.toLocaleDateString()}</span></div><span className="pill">{project.status.toLowerCase()}</span></div>)}</div> : <div className="empty-state"><strong>Your first project is waiting.</strong>Create a project to give the workspace a useful centre.</div>}</section>
      <section className="panel"><h3>Workspace health</h3><p className="panel-subtitle">The foundation is ready for your product logic.</p><div className="list"><div className="list-row"><div><strong><FolderKanban size={15} style={{ verticalAlign: "-2px", marginRight: 7 }} />Projects</strong><span>Tenant-scoped data</span></div><span className="pill">Ready</span></div><div className="list-row"><div><strong><HardDrive size={15} style={{ verticalAlign: "-2px", marginRight: 7 }} />Drive uploads</strong><span>Private server route</span></div><span className="pill">Ready</span></div><div className="list-row"><div><strong><Users size={15} style={{ verticalAlign: "-2px", marginRight: 7 }} />Role controls</strong><span>Owner / admin / member</span></div><span className="pill">Ready</span></div></div><Link href="/app/settings" className="button button-quiet" style={{ marginTop: 18 }}>Review settings</Link></section>
    </div>
  </div>;
}
