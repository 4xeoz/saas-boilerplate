"use client";

import { useState } from "react";

export function CheckoutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setPending(true);
    setError(null);
    const response = await fetch("/api/billing/checkout", { method: "POST" });
    const data = await response.json() as { url?: string; error?: string };
    if (!response.ok || !data.url) setError(data.error || "Billing is not configured yet.");
    else window.location.assign(data.url);
    setPending(false);
  }

  return (
    <div>
      <button className="button button-primary" onClick={startCheckout} disabled={pending}>{pending ? "Opening checkout…" : "Upgrade to Pro"}</button>
      {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}
    </div>
  );
}
