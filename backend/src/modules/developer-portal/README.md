# Developer Portal

**Role:** Developer-owned organization and API-key control surface
**Status:** Active

## Ownership

This module serves authenticated developers. It owns organization creation, API-key lifecycle, and
redacted organization Event history. It does not own user sessions, Connector credentials, Grant
authority, Event ingress, Delivery effects, or public deployment controls.

Every route requires the `developer_session` httpOnly cookie. Organization queries include the
authenticated developer identity; another developer's organization is indistinguishable from not found.
Cookie-authenticated POST routes require the configured frontend Origin and strict JSON body validation.
Private responses set no-store headers.

## Routes

| Method | Path | Result |
|---|---|---|
| GET | `/api/organizations` | Developer-owned organization summaries |
| POST | `/api/organizations` | Create an organization and reveal its first API key once |
| GET | `/api/organizations/:organizationId/api-keys` | Metadata-only key list |
| POST | `/api/organizations/:organizationId/api-keys` | Create and reveal one key once |
| POST | `/api/organizations/:organizationId/api-keys/:apiKeyId/revoke` | Idempotent key revocation |
| GET | `/api/organizations/:organizationId/events` | At most 100 newest redacted Event/Delivery summaries |

Organization names are bounded and strict. API keys are 32 random bytes encoded as base64url; only
their digest, prefix, timestamps, and revocation state are stored. A raw key appears only in its
creation response and never in list, revoke, Event history, logs, or database projections.

Event history is an allow-listed projection containing Event identity/type/origin/workflow/time and
Delivery state/attempt/acknowledgement/terminal reason. It excludes Event body, canonical URL, Host
subject, Grant, Consent, Connector, key, and other private authority material.

## Verification boundary

The module's tests cover developer ownership, CSRF origin, strict body validation, one-time key reveal,
idempotent revoke, metadata-only reads, redacted history, and cross-account denial. A passing portal
suite proves this HTTP/module scope only; it does not prove standing conformance or deployment.
