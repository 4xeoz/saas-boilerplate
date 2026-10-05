"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function UploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return setStatus("Choose a file first.");
    if (file.size > 25 * 1024 * 1024) return setStatus("Files must be smaller than 25 MB.");
    setPending(true);
    setStatus(null);
    const data = new FormData();
    data.set("file", file);
    const response = await fetch("/api/uploads/drive", { method: "POST", body: data });
    const result = await response.json() as { error?: string; file?: { name?: string } };
    setStatus(response.ok ? `${result.file?.name || file.name} uploaded.` : result.error || "Upload failed.");
    if (response.ok) {
      setFile(null);
      router.refresh();
    }
    setPending(false);
  }

  return (
    <form className="form-stack" onSubmit={submit}>
      <div className="field"><label htmlFor="file">File (25 MB maximum)</label><input id="file" type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} /></div>
      {status && <p className={status.endsWith("uploaded.") ? "form-note" : "form-error"} role="status">{status}</p>}
      <button className="button button-dark" type="submit" disabled={pending}>{pending ? "Uploading…" : "Upload to Drive"}</button>
    </form>
  );
}
