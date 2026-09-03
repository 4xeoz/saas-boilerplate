import type { Request, Response } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { StandingProtocolError } from "./standing.protocol";
import {
  acknowledgeStandingDelivery,
  acceptStandingEvent,
  claimStandingDelivery,
  StandingReceiverError,
  type StandingEffectAuthority,
} from "./standing.service";
import type {
  StandingDeliveryAcknowledgementBody,
  StandingDeliveryClaimBody,
  StandingEventEnvelopeBody,
} from "./standing.schemas";

function sendStandingError(
  res: Response,
  error: StandingReceiverError | StandingProtocolError
): void {
  if (error.retryable && error.statusCode === 503) {
    res.set("Retry-After", "1");
  }
  res.status(error.statusCode).json({
    error: {
      code: error.code,
      retryable: error.retryable,
    },
  });
}

function isStandingError(
  error: unknown
): error is StandingReceiverError | StandingProtocolError {
  return error instanceof StandingReceiverError || error instanceof StandingProtocolError;
}

export const acceptStandingEventController = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const result = await acceptStandingEvent(req.body as StandingEventEnvelopeBody);
      return res.status(202).json(result);
    } catch (error) {
      if (isStandingError(error)) {
        sendStandingError(res, error);
        return;
      }
      throw error;
    }
  }
);

export const claimStandingDeliveryController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as StandingDeliveryClaimBody;
    try {
      const result = await claimStandingDelivery({
        connectorToken: body.connector_token,
        claimToken: body.claim_token,
      });
      if (result === null) {
        res.set("Content-Length", "0");
        res.removeHeader("Content-Type");
        return res.status(204).end();
      }
      return res.status(200).json(result);
    } catch (error) {
      if (isStandingError(error)) {
        sendStandingError(res, error);
        return;
      }
      throw error;
    }
  }
);

export const acknowledgeStandingDeliveryController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as StandingDeliveryAcknowledgementBody;
    try {
      const result = await acknowledgeStandingDelivery({
        connectorToken: body.connector_token,
        deliveryId: body.delivery_id,
        leaseToken: body.lease_token,
        effectToken: body.effect_token,
        effectAuthority: req.app.locals.standingEffectAuthority as
          | StandingEffectAuthority
          | undefined,
      });
      return res.status(200).json(result);
    } catch (error) {
      if (isStandingError(error)) {
        sendStandingError(res, error);
        return;
      }
      throw error;
    }
  }
);
