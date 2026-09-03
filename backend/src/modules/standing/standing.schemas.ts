export const standingDeliveryClaimFields = [
  "connector_token",
  "claim_token",
] as const;

export const standingDeliveryAcknowledgementFields = [
  "connector_token",
  "delivery_id",
  "lease_token",
  "effect_token",
] as const;

// These are controller boundary views only. Runtime value validation remains
// in the standing protocol/Receiver service so its typed status and code are
// not collapsed into an HTTP-body error.
export type StandingEventEnvelopeBody = {
  body: string;
  headers: {
    "WebMCP-Reentry-Key-Id": string;
    "WebMCP-Reentry-Timestamp": string;
    "WebMCP-Reentry-Signature": string;
  };
};

export type StandingDeliveryClaimBody = {
  connector_token: string;
  claim_token: string;
};

export type StandingDeliveryAcknowledgementBody = {
  connector_token: string;
  delivery_id: string;
  lease_token: string;
  effect_token: string;
};
