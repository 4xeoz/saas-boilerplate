import Link from "next/link";
import { Brand } from "@/components/brand";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Create a workspace" };

export default function RegisterPage() {
  return <main className="auth-page"><section className="auth-showcase"><Brand dark /><div><span className="eyebrow" style={{ color: "#b9f57b" }}>Start with a clean slate</span><h1>Make room for the next thing.</h1><p>Create a workspace in under a minute. You become its owner and can invite teammates when you are ready.</p><div className="auth-points"><div className="auth-point">Real account</div><div className="auth-point">Role-ready</div><div className="auth-point">No lock-in</div></div></div><span style={{ color: "rgba(255,255,255,.45)", fontSize: 12 }}>Northstar · secure workspace starter</span></section><section className="auth-panel"><div className="auth-card"><Link href="/" style={{ color: "var(--muted)", fontSize: 13 }}>← Back to home</Link><h2>Create your workspace.</h2><p>Your first account is the workspace owner.</p><AuthForm mode="register" /></div></section></main>;
}
