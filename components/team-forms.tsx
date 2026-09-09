"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteMember, updateMemberRole } from "@/actions/workspace";

export function InviteForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const data = new FormData(event.currentTarget);
    startTransition(async () => { const result = await inviteMember(data); if (!result.success) setError(result.error || "Could not invite member."); else { event.currentTarget.reset(); router.refresh(); } });
  }
  return <form className="form-stack" onSubmit={submit}><div className="field"><label htmlFor="invite-email">Email address</label><input id="invite-email" name="email" type="email" required /></div><div className="field"><label htmlFor="invite-role">Role</label><select id="invite-role" name="role" defaultValue="MEMBER"><option value="MEMBER">Member</option><option value="ADMIN">Admin</option></select></div>{error && <p className="form-error">{error}</p>}<button className="button button-dark" type="submit" disabled={pending}>{pending ? "Inviting…" : "Send invitation"}</button></form>;
}

export function RoleForm({ memberId, role }: { memberId: string; role: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <form action={(formData) => startTransition(async () => { await updateMemberRole(formData); router.refresh(); })}><input type="hidden" name="memberId" value={memberId} /><select name="role" defaultValue={role} disabled={pending} aria-label="Change member role"><option value="MEMBER">Member</option><option value="ADMIN">Admin</option></select><button className="button button-quiet" style={{ minHeight: 32, marginLeft: 6, padding: "0 10px", fontSize: 11 }} type="submit">Save</button></form>;
}
