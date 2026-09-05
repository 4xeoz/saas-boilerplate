# Authentication

**Role:** Shared credential validation and typed session-cookie primitives
**Status:** Active

This module provides the common email/password schemas, JWT signing and verification, and cookie
lifecycle used by the separate User and Developer account modules. It does not own a combined
account table, role system, OAuth flow, refresh-token table, or bearer-token fallback.

## Session contract

- `user_session` is accepted only by User routes.
- `developer_session` is accepted only by Developer routes.
- Each JWT carries the account id as `sub` and its account type as `kind`.
- Cookies are httpOnly; localhost uses SameSite Lax, while an explicitly configured split-origin
  production flow uses SameSite None and Secure.
- State-changing browser requests require the configured frontend Origin and JSON body before
  clearing only the matching cookie; logout is idempotent when that session is absent.

Account-specific services and controllers remain in `../users/` and `../developers/`.
