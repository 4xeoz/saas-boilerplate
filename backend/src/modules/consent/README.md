# Consent, Target, and Grant Status

**Role:** Host enrollment, account decision, target binding, and Grant projection
**Status:** Active

## Ownership

This module owns Organization API-key-authenticated Host-key registration, signed Manifest
verification, opaque Consent sessions, User approval/decline, one durable `(organization, host
subject)` binding to one Connector target, persisted decision status, derived Grant status, and the
private configured-authority revocation fence used by local verification.

## Routes and boundaries

- `POST /v0.1/host-keys` accepts an Organization API key and stores only the Host public key.
- `POST /v0.1/consent-sessions` validates a signed Manifest and returns an opaque session.
- `GET /consent?token=...` serves the bounded User consent handoff. The shared page validates the v0.1
  or standing v0.2 token namespace; standing-specific behavior is owned by [Standing Authorization
  v0.2](../standing/README.md).
- `POST /v0.1/account-consent-decisions` requires the User session, same-origin JSON, and an owned
  eligible Connector.
- `GET /v0.1/consent-sessions/:id` returns Organization-scoped decision and Grant status.

Consent-token digests, Host subject references, Organization keys, and control values are never
persisted as raw bearer values. The opaque page token is carried only inside the generated
`consent_url` handoff; it is not returned as a standalone field or included in status/projection
responses. Host responses exclude User ids, Connector credentials, target ids, and private Grant
fields. The first approved Host subject remains bound to one Connector target; a different target is
a conflict.

Signed Event ingress, Delivery, acknowledgement, and standing transport are separate module
boundaries. Public Grant inspection or revocation is not registered by this README.

## Verification boundary

- `test/standing-consent-http.integration.test.ts`: real shared-page namespace dispatch, login,
  Connector eligibility, decision persistence, and served popup script with simulated browser objects.
  Requires a verified disposable PostgreSQL database; does not establish real-browser continuation.

- `test/consent-page.test.ts` covers the v0.1 renderer's bounded pending/terminal output, Connector
  availability, escaping, and popup-origin/session messaging.
- `test/consent-page-http.test.ts` covers shared-page login/standing dispatch and standing decision
  HTTP boundary mapping with mocked services; it does not prove database lookup or persistence.
- `test/consent.test.ts` covers the database-backed v0.1 Consent, binding, and decision lifecycle when
  run with an explicitly disposable PostgreSQL database.
