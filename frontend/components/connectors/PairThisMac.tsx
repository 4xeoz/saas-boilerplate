"use client";

import { useState } from "react";
import { useEffect } from "react";
import { FiMonitor } from "react-icons/fi";
import {
  createPairingSession,
  listConnectors,
  type ConnectorSummary,
  type PairingSession,
} from "@/lib/api/pairing";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

type PairingState = "pending" | "used" | "expired";

function formatExpiry(value: string): string {
  const expiry = new Date(value);
  if (!Number.isFinite(expiry.getTime())) return "soon";

  return expiry.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Unknown date";

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function connectorStatus(connector: ConnectorSummary): "Paired" | "Expired" | "Revoked" {
  if (connector.revoked_at) return "Revoked";
  if (Date.parse(connector.expires_at) <= Date.now()) return "Expired";
  return "Paired";
}

function connectorBadgeVariant(status: "Paired" | "Expired" | "Revoked") {
  if (status === "Paired") return "success" as const;
  if (status === "Expired") return "warning" as const;
  return "error" as const;
}

export default function PairThisMac() {
  const [pairing, setPairing] = useState<PairingSession | null>(null);
  const [pairingState, setPairingState] = useState<PairingState>("pending");
  const [pairedConnector, setPairedConnector] = useState<ConnectorSummary | null>(null);
  const [connectors, setConnectors] = useState<ConnectorSummary[]>([]);
  const [isLoadingConnectors, setIsLoadingConnectors] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [connectorError, setConnectorError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadConnectors() {
      setIsLoadingConnectors(true);
      try {
        const result = await listConnectors();
        if (cancelled) return;
        setConnectors(result.connectors);
        setConnectorError(null);
      } catch (requestError) {
        if (cancelled) return;
        setConnectorError(
          requestError instanceof Error ? requestError.message : "Unable to load paired Macs.",
        );
      } finally {
        if (!cancelled) setIsLoadingConnectors(false);
      }
    }

    void loadConnectors();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!pairing || pairingState !== "pending") return;

    let cancelled = false;
    const pairingId = pairing.pairing_id;
    const expiresAt = Date.parse(pairing.expires_at);

    function markExpired() {
      if (!cancelled) setPairingState("expired");
    }

    async function checkPairing() {
      if (Date.now() >= expiresAt) {
        markExpired();
        return;
      }

      try {
        const result = await listConnectors();
        if (cancelled) return;
        setConnectors(result.connectors);
        setConnectorError(null);
        const connector = result.connectors.find(
          (item) => item.pairing_id === pairingId,
        );
        if (connector) {
          setPairedConnector(connector);
          setPairingState("used");
        }
      } catch (requestError) {
        if (!cancelled) {
          setConnectorError(
            requestError instanceof Error ? requestError.message : "Unable to check pairing status.",
          );
        }
      }
    }

    void checkPairing();
    const intervalId = window.setInterval(() => void checkPairing(), 2_000);
    const timeoutId = window.setTimeout(markExpired, Math.max(0, expiresAt - Date.now()));

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [pairing, pairingState]);

  async function handlePairThisMac() {
    setPairingError(null);
    setIsSubmitting(true);

    try {
      setPairing(await createPairingSession());
      setPairingState("pending");
      setPairedConnector(null);
    } catch (requestError) {
      setPairingError(
        requestError instanceof Error ? requestError.message : "Unable to pair this Mac.",
      );
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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
                One-time pairing code
              </p>
              <p
                aria-label="Pairing code"
                className="mt-2 font-mono text-3xl font-bold tracking-[0.22em] text-brand-2 dark:text-text-primary"
              >
                {pairingState === "pending"
                  ? pairing.pairing_code
                  : pairingState === "used"
                    ? "USED"
                    : "EXPIRED"}
              </p>
            </div>
            <Badge
              variant={pairingState === "pending" ? "accent" : pairingState === "used" ? "success" : "warning"}
              size="md"
            >
              {pairingState === "pending" ? "Waiting for Mac" : pairingState === "used" ? "Used" : "Expired"}
            </Badge>
          </div>
          <p className="mt-3 text-sm text-text-secondary">
            {pairingState === "pending"
              ? `Enter this code in the Local Connector before ${formatExpiry(pairing.expires_at)}. The dashboard checks automatically.`
              : pairingState === "used"
                ? `${pairedConnector?.device_name ?? "Your Mac"} is connected to this account.`
                : "This code has expired. Generate a new code to pair a Mac."}
          </p>
        </div>
      ) : null}

      {pairingError ? (
        <p role="alert" className="mt-4 rounded-lg border border-error-border bg-error-bg px-3 py-2 text-sm text-error-text">
          {pairingError}
        </p>
      ) : null}

      <Card hover={false} className="mt-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-text-primary">Paired devices</h2>
          <p className="text-sm leading-6 text-text-secondary">
            Macs paired with this account. Paired does not indicate that a device is currently online.
          </p>
        </div>

        {isLoadingConnectors ? (
          <p className="mt-5 text-sm text-text-secondary">Loading paired devices…</p>
        ) : connectors.length === 0 ? (
          <p className="mt-5 text-sm text-text-secondary">No Macs are paired yet.</p>
        ) : (
          <ul className="mt-5 divide-y divide-border">
            {connectors.map((connector) => {
              const status = connectorStatus(connector);
              return (
                <li key={connector.connector_id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-semibold text-text-primary">{connector.device_name}</p>
                    <p className="mt-1 text-xs text-text-muted">
                      Paired {formatDate(connector.created_at)} · Expires {formatDate(connector.expires_at)}
                    </p>
                  </div>
                  <Badge variant={connectorBadgeVariant(status)}>{status}</Badge>
                </li>
              );
            })}
          </ul>
        )}

        {connectorError ? (
          <p role="alert" className="mt-4 rounded-lg border border-error-border bg-error-bg px-3 py-2 text-sm text-error-text">
            {connectorError}
          </p>
        ) : null}
      </Card>
    </Card>
  );
}
