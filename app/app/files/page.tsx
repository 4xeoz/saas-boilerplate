import { getAssets } from "@/actions/workspace";
import { UploadForm } from "@/components/upload-form";

export const metadata = { title: "Files" };

export default async function FilesPage() {
  const assets = await getAssets();
  return <div><div className="content-header"><div><span className="eyebrow">Private storage</span><h2>Files.</h2><p>Upload workspace files to Google Drive through a server-only integration.</p></div></div><div className="two-column"><section className="panel"><h3>Upload a file</h3><p className="panel-subtitle">Files are limited to 25 MB in this starter. Add resumable uploads when your product needs them.</p><UploadForm /></section><section className="panel"><h3>Recent files</h3><p className="panel-subtitle">Only metadata is stored in the app database.</p>{assets.length ? <div className="list">{assets.map((asset) => <div className="list-row" key={asset.id}><div><strong>{asset.name}</strong><span>{asset.createdAt.toLocaleDateString()} · {(asset.size / 1024).toFixed(1)} KB</span></div>{asset.driveUrl ? <a className="pill" href={asset.driveUrl} target="_blank" rel="noreferrer">Open</a> : <span className="pill">Stored</span>}</div>)}</div> : <div className="empty-state"><strong>No files yet.</strong>Upload your first file to the workspace.</div>}</section></div><p className="form-note" style={{ marginTop: 16 }}>Configure Google Drive credentials in <code>.env.local</code>; the UI remains safe when the provider is not configured.</p></div>;
}
