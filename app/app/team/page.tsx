import { getTeamData } from "@/actions/workspace";
import { InviteForm, RoleForm } from "@/components/team-forms";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const data = await getTeamData();
  const canInvite = data.role === "OWNER" || data.role === "ADMIN";
  return <div><div className="content-header"><div><span className="eyebrow">Workspace access</span><h2>Team.</h2><p>Keep membership and roles explicit. Permissions are checked on the server.</p></div></div><div className="two-column"><section className="panel"><h3>Members</h3><p className="panel-subtitle">Owner can change roles. Admin can invite members.</p><div className="table-wrap"><table><thead><tr><th>Person</th><th>Role</th><th>Joined</th><th /></tr></thead><tbody>{data.members.map((member) => <tr key={member.id}><td><strong>{member.user.name || "Unnamed member"}</strong><div style={{ color: "var(--muted)", marginTop: 4 }}>{member.user.email}</div></td><td><span className="pill">{member.role.toLowerCase()}</span></td><td>{member.createdAt.toLocaleDateString()}</td><td>{data.role === "OWNER" && member.role !== "OWNER" ? <RoleForm memberId={member.id} role={member.role} /> : null}</td></tr>)}</tbody></table></div></section><section className="panel"><h3>Invite someone</h3><p className="panel-subtitle">The invitation is emailed when Resend is configured; otherwise it is safely logged as skipped.</p>{canInvite ? <InviteForm /> : <div className="empty-state">Only an owner or admin can invite members.</div>}<h3 style={{ marginTop: 30 }}>Pending invites</h3>{data.invitations.length ? <div className="list">{data.invitations.map((invite) => <div className="list-row" key={invite.id}><div><strong>{invite.email}</strong><span>{invite.role.toLowerCase()} · expires {invite.expiresAt.toLocaleDateString()}</span></div><span className="pill">pending</span></div>)}</div> : <p className="form-note">No pending invites.</p>}</section></div></div>;
}
