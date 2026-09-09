import Link from "next/link";
import { Brand } from "@/components/brand";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return <main className="auth-page"><section className="auth-showcase"><Brand dark /><div><span className="eyebrow" style={{ color: "#b9f57b" }}>Workspace access</span><h1>Good work has a way back.</h1><p>Sign in to pick up where your team left off.</p><div className="auth-points"><div className="auth-point">Private by default</div><div className="auth-point">Clear roles</div><div className="auth-point">Ready to extend</div></div></div><span style={{ color: "rgba(255,255,255,.45)", fontSize: 12 }}>Northstar · secure workspace starter</span></section><section className="auth-panel"><div className="auth-card"><Link href="/" style={{ color: "var(--muted)", fontSize: 13 }}>← Back to home</Link><h2>Welcome back.</h2><p>Use your workspace email and password to continue.</p><AuthForm mode="login" /></div></section></main>;
}
