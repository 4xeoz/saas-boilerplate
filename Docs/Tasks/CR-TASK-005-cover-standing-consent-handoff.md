# CR-TASK-005 — Cover the standing Consent handoff

**Status:** Open
**Owner:** Standing module and consent verification boundary

## Outcome

Independently verify the implemented standing Consent handoff at its renderer and shared HTTP page
boundaries without expanding the unaccepted account-facing control-plane shell.

## Current boundary

The current source dispatches the shared `GET /consent?token=...` route between the v0.1 and standing
v0.2 token namespaces. The standing branch requires an authenticated User session, renders one
bounded Consent session, redirects unauthenticated users through the User login continuation, and
posts same-user decisions to `/v0.2/account-consent-decisions`. A focused standing renderer test now
covers the bounded pending and terminal page output, Connector availability, Host-controlled field
escaping, and exact popup-origin/session messaging. No dedicated HTTP integration test was found
during the documentation audit.

Until this task closes, login continuation, v0.1/standing namespace dispatch, expiry response,
token non-echo across the HTTP boundary, account-owned Connector projection, same-user decision,
and the HTTP-level popup-origin/session contract remain source-readback claims rather than
independently verified page claims. Renderer-only claims are independently covered by the focused
test above.

## Next gate

Add focused HTTP coverage for both standing and v0.1 token dispatch, authenticated and
unauthenticated access, pending/approved/declined/expired outcomes, token redaction, wrong-user
decision rejection, Connector availability, and popup message origin/session bounds. Run the focused
tests with the required disposable database, then rerun the applicable aggregate and update
[Validation and evidence](../Core/05-validation-and-evidence.md).

## Non-goals

- Do not add the proposed `/v1/standing/*` account-facing shell.
- Do not change token custody, login policy, route envelopes, or standing authority as a test shortcut.
- Do not claim hosted, production, or external continuation from renderer or local HTTP tests.

## Reopen condition

Reopen when the shared consent-page route, standing token namespace, User-session boundary, page
rendering, popup protocol, or account decision contract changes.
