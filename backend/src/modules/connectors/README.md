# Connector Pairing

**Role:** Account-owned Connector identity and lifecycle boundary
**Status:** Active

## Ownership

This module owns short-lived pairing sessions, cookie-free Connector claiming, digest-only token
storage, account-scoped device metadata, and self-disconnection. Delivery lease, acknowledgement,
Consent, Grant, and standing transport rules belong to their owning modules.

## Routes

| Method | Path | Boundary |
|---|---|---|
| POST | `/v0.1/account/pairing-sessions` | Authenticated User creates a short-lived public pairing id and code |
| POST | `/v0.1/account/pairing-sessions/claim` | Cookie-free Connector claims exactly one pairing with `pairing_id`, `pairing_code`, and `device_name` |
| GET | `/v0.1/account/connectors` | User reads lifecycle metadata only |
| POST | `/v0.1/connectors/disconnect` | Connector revokes its saved token once and retains history |

The first claim reveals the raw Connector token once. An exact replay returns the same metadata with
no token. Pairing codes and Connector tokens are stored only as SHA-256 digests.

Anonymous claims require a trusted provider source identity and a durable bounded source budget.
Five wrong codes for one pairing produce generic failures; the terminal attempt expires the pairing.
Missing identity, invalid identity, or limiter-store failure fails closed with a bounded busy result.

## Verification boundary

Tests cover code entropy/expiry, wrong-code fencing, source limits, duplicate claims, scope,
disconnect replay, token redaction, and restart persistence. They do not prove delivery, Consent,
Grant authority, or deployment.
