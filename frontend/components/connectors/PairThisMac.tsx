"use client";

import { useState } from "react";
import { useEffect } from "react";
import { FiClock, FiInfo, FiMonitor, FiRefreshCw } from "react-icons/fi";
import {
  createPairingSession,
  listConnectors,
  type ConnectorSummary,
  type PairingSession,
} from "@/lib/api/pairing";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

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
    <section
      id="devices"
      aria-labelledby="devices-title"
      className="mt-10 max-w-5xl overflow-hidden rounded-[28px] border border-border bg-surface shadow-[0_24px_80px_rgba(14,15,12,0.08)]"
    >
      <div className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-1/15 text-brand-2 dark:text-brand-1">
            <FiMonitor className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">Connected devices</p>
            <h2 id="devices-title" className="mt-1 text-xl font-bold tracking-[-0.03em] text-text-primary">Pair a Mac</h2>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={() => void handlePairThisMac()}
          isLoading={isSubmitting}
        >
          {pairing ? <FiRefreshCw aria-hidden="true" /> : <FiMonitor aria-hidden="true" />}
          <span>{pairing ? "New code" : "Pair this Mac"}</span>
        </Button>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="border-b border-border p-5 sm:p-7 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">One-time code</p>
            {pairing ? (
              <Badge
                variant={pairingState === "pending" ? "accent" : pairingState === "used" ? "success" : "warning"}
                size="md"
              >
                {pairingState === "pending" ? "Waiting" : pairingState === "used" ? "Used" : "Expired"}
              </Badge>
            ) : null}
          </div>

          {pairing ? (
            <p
              aria-label="Pairing code"
              aria-live="polite"
              className="mt-10 font-mono text-[clamp(36px,5vw,52px)] font-bold leading-none tracking-[0.16em] text-brand-2 dark:text-text-primary"
            >
              {pairingState === "pending"
                ? pairing.pairing_code
                : pairingState === "used"
                  ? "USED"
                  : "EXPIRED"}
            </p>
          ) : (
            <div className="mt-10 flex h-[92px] items-center gap-3 rounded-2xl border border-dashed border-border-secondary bg-background-secondary px-4 text-text-muted">
              <FiMonitor className="h-5 w-5" aria-hidden="true" />
              <span className="text-sm">No code yet</span>
            </div>
          )}

          <p aria-live="polite" className="mt-5 max-w-sm text-sm leading-6 text-text-secondary">
            {pairingState === "pending" && pairing
              ? `Enter it in the Local Connector before ${formatExpiry(pairing.expires_at)}.`
              : pairingState === "used"
                ? `${pairedConnector?.device_name ?? "Your Mac"} is connected to this account.`
                : pairingState === "expired"
                  ? "Code expired. Create another."
                  : "Create a code to connect a Mac."}
          </p>

          {pairingError ? (
            <p role="alert" className="mt-4 rounded-lg border border-error-border bg-error-bg px-3 py-2 text-sm text-error-text">
              {pairingError}
            </p>
          ) : null}
        </div>

        <div className="p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">Account devices</p>
              <h3 className="mt-1 text-xl font-bold tracking-[-0.03em] text-text-primary">Paired devices</h3>
            </div>
            <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-background-secondary px-2 font-mono text-xs font-bold text-text-secondary" aria-label={`${connectors.length} paired devices`}>
              {connectors.length}
            </span>
          </div>

          {isLoadingConnectors ? (
            <p className="mt-8 text-sm text-text-secondary">Loading…</p>
          ) : connectors.length === 0 ? (
            <div className="mt-8 flex items-center gap-3 text-sm text-text-secondary">
              <FiClock className="h-4 w-4 text-text-muted" aria-hidden="true" />
              No Macs paired yet.
            </div>
          ) : (
            <ul className="mt-6 divide-y divide-border">
              {connectors.map((connector) => {
                const status = connectorStatus(connector);
                return (
                  <li key={connector.connector_id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-1/10 text-brand-2 dark:text-brand-1">
                        <FiMonitor className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-text-primary">{connector.device_name}</p>
                        <p className="mt-1 truncate text-xs text-text-muted">
                          Added {formatDate(connector.created_at)} · Expires {formatDate(connector.expires_at)}
                        </p>
                      </div>
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

          <p className="mt-7 flex items-center gap-2 text-xs text-text-muted">
            <FiInfo className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Pairing status is not live presence.
          </p>
        </div>
      </div>
    </section>
  );
}
