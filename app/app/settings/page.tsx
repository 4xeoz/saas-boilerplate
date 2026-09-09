import { getWorkspaceSettings } from "@/actions/workspace";
import { SettingsForm } from "@/components/settings-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const data = await getWorkspaceSettings();
  return <div><div className="content-header"><div><span className="eyebrow">Workspace configuration</span><h2>Settings.</h2><p>Keep the account name and ownership boundary easy to understand.</p></div></div><section className="panel" style={{ maxWidth: 620 }}><h3>Workspace</h3><p className="panel-subtitle">You are signed in as {data.role.toLowerCase()}.</p><SettingsForm name={data.organization.name} /></section></div>;
}
