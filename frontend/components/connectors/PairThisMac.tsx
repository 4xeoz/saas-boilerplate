"use client";

import { useState } from "react";
import { FiMonitor } from "react-icons/fi";
import { createPairingSession, type PairingSession } from "@/lib/api/pairing";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

function formatExpiry(value: string): string {
  const expiry = new Date(value);
  if (!Number.isFinite(expiry.getTime())) return "soon";

  return expiry.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function PairThisMac() {
  const [pairing, setPairing] = useState<PairingSession | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePairThisMac() {
    setError(null);
    setIsSubmitting(true);

    try {
      setPairing(await createPairingSession());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to pair this Mac.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card hover={false} className="mt-8 max-w-2xl">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-1/10 text-brand-2 dark:text-brand-1">
            <FiMonitor className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary">Pair this Mac</h2>
            <p className="mt-1 max-w-lg text-sm leading-6 text-text-secondary">
              Generate a one-time code for the Local Connector. It expires in 10 minutes and is
              shown only after you request it.
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={() => void handlePairThisMac()}
          isLoading={isSubmitting}
        >
          {pairing ? "Generate a new code" : "Pair this Mac"}
        </Button>
      </div>

      {pairing ? (
        <div className="mt-6 rounded-xl border border-brand-1/40 bg-brand-mint p-5 dark:bg-brand-pastel/20">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
            One-time pairing code
          </p>
          <p
            aria-label="Pairing code"
            className="mt-2 font-mono text-3xl font-bold tracking-[0.22em] text-brand-2 dark:text-text-primary"
          >
            {pairing.pairing_code}
          </p>
          <p className="mt-3 text-sm text-text-secondary">
            Enter this code in the Local Connector before {formatExpiry(pairing.expires_at)}.
          </p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 rounded-lg border border-error-border bg-error-bg px-3 py-2 text-sm text-error-text">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
