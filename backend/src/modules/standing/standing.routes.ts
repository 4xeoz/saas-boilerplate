import { Router } from "express";
import { validateStandingProtocolFields } from "./standing.transport";
import {
  acknowledgeStandingDeliveryController,
  acceptStandingEventController,
  claimStandingDeliveryController,
} from "./standing.controller";
import {
  standingDeliveryAcknowledgementFields,
  standingDeliveryClaimFields,
} from "./standing.schemas";

export const standingRouter = Router();

standingRouter.post(
  "/events",
  acceptStandingEventController
);

standingRouter.post(
  "/delivery-claims",
  validateStandingProtocolFields(standingDeliveryClaimFields),
  claimStandingDeliveryController
);

standingRouter.post(
  "/delivery-acknowledgements",
  validateStandingProtocolFields(standingDeliveryAcknowledgementFields),
  acknowledgeStandingDeliveryController
);

standingRouter.use((_req, res) => {
  res.status(404).json({
    error: {
      code: "http_route_not_found",
      retryable: false,
    },
  });
});
