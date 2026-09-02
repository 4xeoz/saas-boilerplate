"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  loginDeveloper,
  registerDeveloper,
} from "@/lib/api/developer-auth";
import { loginUser, registerUser } from "@/lib/api/user-auth";

type AccountKind = "user" | "developer";

const copy: Record<AccountKind, { title: string; description: string; switchPath: string }> = {
  user: {
    title: "User sign in",
    description: "Access your Cloud Receiver account.",
    switchPath: "/developer-login",
  },
  developer: {
    title: "Developer sign in",
    description: "Access the developer workspace.",
    switchPath: "/login",
  },
};

export default function AuthPage({ kind }: { kind: AccountKind }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const accountCopy = copy[kind];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (kind === "user") {
        if (isRegistering) {
          await registerUser(email, password);
        } else {
          await loginUser(email, password);
        }
      } else if (isRegistering) {
        await registerDeveloper(email, password);
      } else {
        await loginDeveloper(email, password);
      }

      window.location.assign(kind === "user" ? "/dashboard" : "/developer-dashboard");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded-2xl bg-surface border border-border p-8 shadow-card">
        <div className="mb-8">
          <Link href="/" className="text-sm font-semibold text-text-secondary hover:text-text-primary">
            ← Cloud Receiver 2
          </Link>
          <h1 className="mt-8 text-3xl font-bold text-text-primary">{isRegistering ? "Create an account" : accountCopy.title}</h1>
          <p className="mt-2 text-text-secondary">{accountCopy.description}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block space-y-2 text-sm font-semibold text-text-primary">
            Email
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label className="block space-y-2 text-sm font-semibold text-text-primary">
            Password
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              autoComplete={isRegistering ? "new-password" : "current-password"}
              minLength={8}
              maxLength={72}
              required
            />
          </label>

          {error ? (
            <p role="alert" className="rounded-lg border border-error-border bg-error-bg px-3 py-2 text-sm text-error-text">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            {isRegistering ? "Create account" : "Sign in"}
          </Button>
        </form>

        <div className="mt-6 flex items-center justify-between gap-4 text-sm">
          <button
            type="button"
            className="font-semibold text-text-secondary hover:text-text-primary"
            onClick={() => {
              setIsRegistering((current) => !current);
              setError(null);
            }}
          >
            {isRegistering ? "Already have an account? Sign in" : "Need an account? Register"}
          </button>
          <Link href={accountCopy.switchPath} className="font-semibold text-brand-2 hover:underline dark:text-brand-1">
            {kind === "user" ? "Developer login" : "User login"}
          </Link>
        </div>
      </section>
    </main>
  );
}
