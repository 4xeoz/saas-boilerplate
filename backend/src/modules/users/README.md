# User Accounts

**Role:** User account lifecycle
**Status:** Active

This module owns the User account model and its typed session flow. It remains separate from
Developer accounts and uses the `user_session` cookie.

## Routes

Mounted at `/v1/auth/users`:

| Method | Path | Purpose |
|---|---|---|
| POST | `/register` | Create a User account and start a session |
| POST | `/login` | Verify credentials and start a session |
| GET | `/me` | Return the current User summary |
| POST | `/logout` | Clear the User session cookie |

The public account shape is `{ id, email }`. Password hashes remain inside the service boundary.
