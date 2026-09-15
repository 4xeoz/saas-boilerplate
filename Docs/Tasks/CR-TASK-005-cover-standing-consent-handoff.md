# CR-TASK-005 — Cover the standing Consent handoff

**Status:** Locally verified — primary-session integration pending
**Owner:** Standing module and consent verification boundary

## Outcome

Independently verify the implemented standing Consent handoff at its renderer and shared HTTP page
boundaries without expanding the unaccepted account-facing control-plane shell.

## Current boundary

The disposable-database-backed `standing-consent-http.integration.test.ts` now exercises real
Express routes, User registration/login cookies, signed enrollment, token lookup, Connector
projection, decisions, and PostgreSQL readback without replacing services with mocks. All 13 cases
pass; the complete backend aggregate passes 28 suites / 203 tests.

Coverage includes v0.1/v0.2 namespace dispatch, login continuation, pending/approved/declined
pages, persisted expiry, token non-echo, eligible account-owned Connectors, empty-account behavior,
Receiver-origin rejection, approval replay/conflict, and decline without Grant creation. The actual
served popup script runs in a VM with simulated browser objects and real decision HTTP; this proves
the exact public completion payload and target origin, not a real-browser or hosted flow.

Pending tokens are not prebound to a User. The account fence rejects selecting another account's
Connector and replaying another account's terminal decision; it does not invent an intended-user
restriction for a still-pending token.

## Next gate

Primary-session review and integration of the test and documentation remain pending. Preserve the
local evidence ceiling recorded in [Validation and evidence](../Core/05-validation-and-evidence.md).
Independent runtime admission, browser behavior, and actual consumer continuation require their own
evidence and are not established by this test.

## Non-goals

- Do not add the proposed `/v1/standing/*` account-facing shell.
- Do not change token custody, login policy, route envelopes, or standing authority as a test shortcut.
- Do not claim hosted, production, or external continuation from renderer or local HTTP tests.

## Reopen condition

Reopen when the shared consent-page route, standing token namespace, User-session boundary, page
rendering, popup protocol, or account decision contract changes.
