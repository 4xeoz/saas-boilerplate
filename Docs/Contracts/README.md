# Cloud Receiver 2 Contracts

**Role:** HTTP, protocol-version, state, and module-contract routing
**Status:** Current implementation baseline; expanded account-facing standing policy remains open

## Contract owners

| Surface | Owner |
|---|---|
| Authentication and session cookies | `backend/src/modules/authentication/`, `users/`, and `developers/` |
| Pairing and Connector lifecycle | `backend/src/modules/connectors/README.md` |
| Consent, target binding, and finite Grant | `backend/src/modules/consent/README.md` |
| Signed Event ingress | `backend/src/modules/events/README.md` |
| Delivery lease and effect acknowledgement | `backend/src/modules/deliveries/README.md` |
| Standing v0.2 | `backend/src/modules/standing/README.md` and its accepted protocol source |
| Developer organization and key controls | `backend/src/modules/developer-portal/README.md` |
| Health and readiness | `backend/src/modules/system-health/README.md` |
| Persistence shape | `backend/prisma/schema.prisma` and ordered migrations |
| Cross-version transport envelope | [HTTP and compatibility](01-http-and-compatibility.md) |

No module README is a substitute for code, schema, tests, or fresh runtime evidence. A change to a
route, field, identity, state transition, response, or migration must update its one contract owner
and the relevant verification gate.

## Non-ownership

This directory does not define consumer-specific Event mapping, page behavior, WebMCP tool names,
human consequences, or a second Re-entry specification. Those remain with the consuming application
or the reusable Core source respectively.
