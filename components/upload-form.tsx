"use client";

import { FormEvent, useState } from "react";

export function UploadForm({ projects }: { projects: Array<{ id: string; name: string }> }) {
  const [projectId, setProjectId] = useState(projects[0]?.id || "");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !projectId) return setStatus("Choose a project and a file first.");
    if (file.size > 25 * 1024 * 1024) return setStatus("Files must be smaller than 25 MB.");
    setPending(true);
    setStatus(null);
    const data = new FormData();
    data.set("file", file);
    data.set("projectId", projectId);
    const response = await fetch("/api/uploads/drive", { method: "POST", body: data });
    const result = await response.json() as { error?: string; file?: { name?: string } };
    setStatus(response.ok ? `${result.file?.name || file.name} uploaded.` : result.error || "Upload failed.");
    if (response.ok) setFile(null);
    setPending(false);
  }

  return (
    <form className="form-stack" onSubmit={submit}>
      <div className="field"><label htmlFor="project">Project</label><select id="project" value={projectId} onChange={(event) => setProjectId(event.target.value)} disabled={!projects.length}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>
      <div className="field"><label htmlFor="file">File (25 MB maximum)</label><input id="file" type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} /></div>
      {status && <p className={status.endsWith("uploaded.") ? "form-note" : "form-error"} role="status">{status}</p>}
      <button className="button button-dark" type="submit" disabled={pending || !projects.length}>{pending ? "Uploading…" : "Upload to Drive"}</button>
      {!projects.length && <p className="form-note">Create a project before uploading files.</p>}
    </form>
  );
}
