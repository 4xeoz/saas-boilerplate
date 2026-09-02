import { Router } from "express";
import { validateProtocolBody } from "../../middleware/protocol-validate";
import { requireSameOriginJson } from "../../middleware/same-origin";
import {
  acknowledgeDeliveryController,
  claimDeliveryController,
} from "../deliveries/delivery.controller";
import { deliveryAcknowledgementSchema } from "../deliveries/delivery.schemas";
import {
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

pairingRouter.post(
  "/delivery-claims",
  validateProtocolBody(deliveryClaimSchema),
  claimDeliveryController,
);

pairingRouter.post(
  "/delivery-acknowledgements",
  validateProtocolBody(deliveryAcknowledgementSchema),
  acknowledgeDeliveryController,
);
