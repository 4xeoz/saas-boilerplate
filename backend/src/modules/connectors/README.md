# Connector Pairing

This module owns the first Cloud Receiver v2 Connector boundary:

- an authenticated User creates a short-lived pairing code;
- a cookie-free Local Connector claims it with a device name;
- the first claim returns one raw Connector token;
- a duplicate claim returns metadata without `connector_token`; and
- an authenticated account can list its paired devices through
  `GET /v0.1/account/connectors`, which returns lifecycle metadata only; and
- the Receiver stores only SHA-256 digests for pairing and Connector tokens.
- the anonymous claim route resolves by the public `pairing_id`, counts wrong
  codes durably (five generic failures, terminal sixth), and applies a
  PostgreSQL-backed thirty-per-ten-minute source budget using the direct Vercel
  provider identity; and
- missing or invalid trusted source identity and limiter-store failure return a
  bounded `receiver_busy` response rather than bypassing the fence.

The `POST /v0.1/delivery-claims` route is mounted beside pairing but its claim and lease behavior
is owned by `modules/deliveries/`. Pairing owns Connector identity issuance and digest lookup; it
does not own delivery state, acknowledgement, or public Grant behavior. The active claim request is
exactly:

```json
{"pairing_id":"pairing_123","pairing_code":"A1B2C3D4","device_name":"Mac One"}
```

The previous two-field body is rejected. The old `runtime/cloud-receiver/` pairing implementation
is retired and is not a compatibility fallback.
