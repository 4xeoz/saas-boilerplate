"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProject } from "@/actions/workspace";

export function CreateProjectForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createProject(data);
      if (!result.success) setError(result.error || "Could not create the project.");
      else router.push("/app/projects");
    });
  }
  return <form className="form-stack" onSubmit={submit}><div className="field"><label htmlFor="name">Project name</label><input id="name" name="name" required minLength={2} maxLength={80} placeholder="Website refresh" /></div><div className="field"><label htmlFor="description">Description <span style={{ fontWeight: 400 }}>(optional)</span></label><textarea id="description" name="description" maxLength={500} placeholder="What is this project for?" /></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="stack-actions"><button type="submit" className="button button-dark" disabled={pending}>{pending ? "Creating…" : "Create project"}</button><button type="button" className="button button-quiet" onClick={() => router.back()}>Cancel</button></div></form>;
}
