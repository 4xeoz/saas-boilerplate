import type { Request, Response } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { StandingProtocolError } from "./standing.protocol";
import {
  acknowledgeStandingDelivery,
  acceptStandingEvent,
  createStandingConsentSession,
  decideStandingConsentByToken,
  claimStandingDelivery,
  getStandingConsentStatus,
  handoffStandingDelivery,
  inspectStandingGrant,
  registerStandingHostKey,
  revokeStandingGrant,
  StandingReceiverError,
  type StandingEffectAuthority,
  type StandingRuntimeAdmissionAuthority,
} from "./standing.service";
import type {
  StandingAccountConsentDecisionBody,
  StandingConsentSessionBody,
  StandingDeliveryAcknowledgementBody,
  StandingDeliveryClaimBody,
  StandingEventEnvelopeBody,
  StandingHostKeyBody,
  StandingNotificationHandoffBody,
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

export const handoffStandingDeliveryController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as StandingNotificationHandoffBody;
    try {
      const result = await handoffStandingDelivery({
        connectorToken: body.connector_token,
        deliveryId: body.delivery_id,
        leaseToken: body.lease_token,
        handoffId: body.handoff_id,
        runtimeAdmissionAttestation: body.runtime_admission_attestation,
        runtimeAdmissionAuthority: req.app.locals.standingRuntimeAdmissionAuthority as
          | StandingRuntimeAdmissionAuthority
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

export const registerStandingHostKeyController = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const organizationId = req.organizationAuth?.organizationId;
      if (!organizationId) {
        res.status(403).json({ error: { code: "organization_auth_invalid", retryable: false } });
        return;
      }
      const body = req.body as StandingHostKeyBody;
      const result = await registerStandingHostKey(organizationId, {
        hostId: body.host_id,
        issuerOrigin: body.issuer_origin,
        keyId: body.key_id,
        publicKeyPem: body.public_key_pem,
      });
      res.set("Cache-Control", "no-store");
      res.status(result.duplicate ? 200 : 201).json(result);
    } catch (error) {
      if (isStandingError(error)) {
        sendStandingError(res, error);
        return;
      }
      throw error;
    }
  },
);

export const createStandingConsentSessionController = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const organizationId = req.organizationAuth?.organizationId;
      if (!organizationId) {
        res.status(403).json({ error: { code: "organization_auth_invalid", retryable: false } });
        return;
      }
      const body = req.body as StandingConsentSessionBody;
      const result = await createStandingConsentSession({
        organizationId,
        hostSubjectRef: body.host_subject_ref,
        expectedOrigin: body.expected_origin,
        manifest: body.manifest,
        maximumGrantLifetimeMs: body.maximum_grant_lifetime_ms,
      });
      res.set("Cache-Control", "no-store");
      res.status(result.duplicate ? 200 : 201).json(result);
    } catch (error) {
      if (isStandingError(error)) {
        sendStandingError(res, error);
        return;
      }
      throw error;
    }
  },
);

export const getStandingConsentStatusController = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const organizationId = req.organizationAuth?.organizationId;
      if (!organizationId) {
        res.status(403).json({ error: { code: "organization_auth_invalid", retryable: false } });
        return;
      }
      const result = await getStandingConsentStatus(
        organizationId,
        String(req.params.consentSessionId),
      );
      res.set("Cache-Control", "no-store");
      res.status(200).json(result);
    } catch (error) {
      if (isStandingError(error)) {
        sendStandingError(res, error);
        return;
      }
      throw error;
    }
  },
);

export const standingAccountConsentDecisionController = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const accountId = req.auth?.accountId;
      if (!accountId) {
        res.status(401).json({ error: { code: "session_required", retryable: false } });
        return;
      }
      const body = req.body as StandingAccountConsentDecisionBody;
      const result = await decideStandingConsentByToken(accountId, {
        consentToken: body.consent_token,
        action: body.action,
        connectorId: body.connector_id,
        decisionId: body.decision_id,
        decidedAt: body.decided_at,
      });
      res.set("Cache-Control", "no-store");
      res.status(200).json(result);
    } catch (error) {
      if (isStandingError(error)) {
        sendStandingError(res, error);
        return;
      }
      throw error;
    }
  },
);

export const inspectStandingGrantController = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const accountId = req.auth?.accountId;
      if (!accountId) {
        res.status(401).json({ error: { code: "session_required", retryable: false } });
        return;
      }
      const result = await inspectStandingGrant({
        accountId,
        bindingId: String(req.params.bindingId),
      });
      res.set("Cache-Control", "no-store");
      res.status(200).json(result);
    } catch (error) {
      if (isStandingError(error)) {
        sendStandingError(res, error);
        return;
      }
      throw error;
    }
  },
);

export const revokeStandingGrantController = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const accountId = req.auth?.accountId;
      if (!accountId) {
        res.status(401).json({ error: { code: "session_required", retryable: false } });
        return;
      }
      const result = await revokeStandingGrant({
        accountId,
        bindingId: String(req.params.bindingId),
      });
      res.set("Cache-Control", "no-store");
      res.status(200).json(result);
    } catch (error) {
      if (isStandingError(error)) {
        sendStandingError(res, error);
        return;
      }
      throw error;
    }
  },
);
