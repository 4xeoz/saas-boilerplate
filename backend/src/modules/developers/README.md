# Developer Accounts

**Role:** Developer account lifecycle
**Status:** Active

This module owns the Developer account model and its typed session flow. It remains separate from
User accounts and uses the `developer_session` cookie.

## Routes

Mounted at `/v1/auth/developers`:

| Method | Path | Purpose |
|---|---|---|
| POST | `/register` | Create a Developer account and start a session |
| POST | `/login` | Verify credentials and start a session |
| GET | `/me` | Return the current Developer summary |
| POST | `/logout` | Clear the Developer session cookie |

The public account shape is `{ id, email }`. Password hashes remain inside the service boundary.
