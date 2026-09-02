# Connector Pairing

This module owns the first Cloud Receiver v2 Connector boundary:

- an authenticated User creates a short-lived pairing code;
- a cookie-free Local Connector claims it with a device name;
- the first claim returns one raw Connector token;
- a duplicate claim returns metadata without `connector_token`; and
- the Receiver stores only SHA-256 digests for pairing and Connector tokens.

The `POST /v0.1/delivery-claims` handler currently contains only the pairing-owned Connector
identity guard needed by `PAIR-005`. Lease, Event, Consent, Host-key, acknowledgement, and other
later Cloud Receiver features must be added in separate increments after the pairing closure gate.
