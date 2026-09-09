import Link from "next/link";
import { CreateProjectForm } from "@/components/create-project-form";

export const metadata = { title: "New project" };

export default function NewProjectPage() {
  return <div><div className="content-header"><div><span className="eyebrow">Projects</span><h2>Start a project.</h2><p>Give the work a clear name. You can add files and teammates later.</p></div><Link href="/app/projects" className="button button-quiet">Back to projects</Link></div><section className="panel" style={{ maxWidth: 620 }}><CreateProjectForm /></section></div>;
}
