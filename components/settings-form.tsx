"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateWorkspace } from "@/actions/workspace";

export function SettingsForm({ name }: { name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setMessage(null); const data = new FormData(event.currentTarget); startTransition(async () => { const result = await updateWorkspace(data); setMessage(result.success ? "Saved." : result.error || "Could not save."); if (result.success) router.refresh(); }); }
  return <form className="form-stack" onSubmit={submit}><div className="field"><label htmlFor="workspace-name">Workspace name</label><input id="workspace-name" name="name" defaultValue={name} required minLength={2} maxLength={80} /></div>{message && <p className={message === "Saved." ? "form-note" : "form-error"} role="status">{message}</p>}<button className="button button-dark" type="submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button></form>;
}
