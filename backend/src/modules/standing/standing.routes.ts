import { Router } from "express";
import { requireOrganizationApiKey } from "../../middleware/organization-auth";
import { validateProtocolBody } from "../../middleware/protocol-validate";
import { requireReceiverOriginJson } from "../../middleware/same-origin";
import { requireSession } from "../authentication/session";
import { validateStandingProtocolFields } from "./standing.transport";
import {
  acknowledgeStandingDeliveryController,
  acceptStandingEventController,
  createStandingConsentSessionController,
  getStandingConsentStatusController,
  inspectStandingGrantController,
  claimStandingDeliveryController,
  handoffStandingDeliveryController,
  registerStandingHostKeyController,
  revokeStandingGrantController,
  standingAccountConsentDecisionController,
} from "./standing.controller";
import {
  standingAccountConsentDecisionSchema,
  standingConsentSessionSchema,
  standingDeliveryAcknowledgementFields,
  standingDeliveryClaimFields,
  standingEmptyBodySchema,
  standingHostKeySchema,
  standingNotificationHandoffFields,
} from "./standing.schemas";

export const standingRouter = Router();

// Host control plane. Organization API-key authentication is required for all
// server-side enrollment calls; the raw key never enters a standing body.
standingRouter.post(
  "/host-keys",
  requireOrganizationApiKey,
  validateProtocolBody(standingHostKeySchema),
  registerStandingHostKeyController,
);

standingRouter.post(
  "/consent-sessions",
  requireOrganizationApiKey,
  validateProtocolBody(standingConsentSessionSchema),
  createStandingConsentSessionController,
);

standingRouter.get(
  "/consent-sessions/:consentSessionId",
  requireOrganizationApiKey,
  getStandingConsentStatusController,
);

// Account decisions and Grant controls are only available to the signed-in
// user and require the Receiver origin on JSON writes for CSRF protection.
standingRouter.post(
  "/account-consent-decisions",
  requireSession("user"),
  requireReceiverOriginJson,
  validateProtocolBody(standingAccountConsentDecisionSchema),
  standingAccountConsentDecisionController,
);

standingRouter.get(
  "/grants/:bindingId",
  requireSession("user"),
  inspectStandingGrantController,
);

standingRouter.post(
  "/grants/:bindingId/revoke",
  requireSession("user"),
  requireReceiverOriginJson,
  validateProtocolBody(standingEmptyBodySchema),
  revokeStandingGrantController,
);

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

standingRouter.post(
  "/delivery-notification-handoffs",
  validateStandingProtocolFields(standingNotificationHandoffFields),
  handoffStandingDeliveryController
);

standingRouter.use((_req, res) => {
  res.status(404).json({
    error: {
      code: "http_route_not_found",
      retryable: false,
    },
  });
});
