"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { login, register } from "@/actions/auth";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = mode === "login" ? await login(data) : await register(data);
      if (!result.success) {
        setError(result.error || "Something went wrong.");
        return;
      }
      const requiresLogin = mode === "register" && "requiresLogin" in result && result.requiresLogin;
      router.push(requiresLogin ? "/sign-in" : "/app/dashboard");
      router.refresh();
    });
  }

  const isRegister = mode === "register";
  return (
    <form className="form-stack" onSubmit={submit}>
      {isRegister && (
        <div className="field">
          <label htmlFor="name">Your name</label>
          <input id="name" name="name" autoComplete="name" required minLength={2} maxLength={80} />
        </div>
      )}
      <div className="field">
        <label htmlFor="email">Email address</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="field">
        <label htmlFor="password">Password {isRegister ? "(12+ characters)" : ""}</label>
        <input id="password" name="password" type="password" autoComplete={isRegister ? "new-password" : "current-password"} required minLength={isRegister ? 12 : 1} />
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-dark" type="submit" disabled={pending}>
        {pending ? "Working…" : isRegister ? "Create workspace" : "Sign in"}
      </button>
      <p className="form-note">Your session uses an encrypted, httpOnly cookie. We never expose database credentials to the browser.</p>
      <p className="form-footer">
        {isRegister ? "Already have an account? " : "Need an account? "}
        <Link href={isRegister ? "/sign-in" : "/register"}>{isRegister ? "Sign in" : "Create one"}</Link>
      </p>
    </form>
  );
}
