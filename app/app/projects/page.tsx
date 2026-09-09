import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getProjects } from "@/actions/workspace";

export const metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const projects = await getProjects();
  return <div><div className="content-header"><div><span className="eyebrow">Workspace</span><h2>Projects.</h2><p>A simple, tenant-scoped place to organise the work.</p></div><Link href="/app/projects/new" className="button button-dark">New project <ArrowUpRight size={16} /></Link></div><section className="panel">{projects.length ? <div className="table-wrap"><table><thead><tr><th>Name</th><th>Status</th><th>Files</th><th>Updated</th></tr></thead><tbody>{projects.map((project) => <tr key={project.id}><td><strong>{project.name}</strong>{project.description && <div style={{ color: "var(--muted)", marginTop: 4 }}>{project.description}</div>}</td><td><span className="pill">{project.status.toLowerCase()}</span></td><td>{project._count.assets}</td><td>{project.updatedAt.toLocaleDateString()}</td></tr>)}</tbody></table></div> : <div className="empty-state"><strong>No projects yet.</strong><Link href="/app/projects/new" style={{ color: "var(--accent-dark)", fontWeight: 700 }}>Create your first project →</Link></div>}</section></div>;
}
