import { Router } from "express";
import { validateProtocolBody } from "../../middleware/protocol-validate";
import { requireSameOriginJson } from "../../middleware/same-origin";
import {
  claimDelivery,
  claimPairing,
  createPairing,
  requireUserSession,
} from "./pairing.controller";
import {
  claimPairingSessionSchema,
  createPairingSessionSchema,
  deliveryClaimSchema,
} from "./pairing.schemas";

export const pairingRouter = Router();

pairingRouter.post(
  "/account/pairing-sessions",
  requireUserSession,
  requireSameOriginJson,
  validateProtocolBody(createPairingSessionSchema),
  createPairing,
);

pairingRouter.post(
  "/account/pairing-sessions/claim",
  validateProtocolBody(claimPairingSessionSchema),
  claimPairing,
);

// Pairing owns the credential identity guard used by the delivery boundary.
// Actual delivery state and lease behavior are deliberately a later increment.
pairingRouter.post(
  "/delivery-claims",
  validateProtocolBody(deliveryClaimSchema),
  claimDelivery,
);
