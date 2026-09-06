import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { appConfig } from "../../../config/config";
import { createApp } from "../../../app";
import * as consentService from "../consent.service";
import { ConsentError } from "../consent.service";
import * as standingService from "../../standing/standing.service";
import { StandingReceiverError } from "../../standing/standing.service";
import type { StandingConsentPrompt } from "../../standing/standing.service";

const app = createApp();
const standingToken = "S".repeat(43);
const decisionTimestamp = "2026-09-06T12:00:00.000Z";

function userCookie(accountId: string): string {
  const token = jwt.sign({ kind: "user" }, appConfig.jwtSecret, { subject: accountId });
  return `user_session=${token}`;
}

function standingPrompt(): StandingConsentPrompt {
  return {
    consentSessionId: "standing_http_session",
    status: "pending",
    session: {
      challenge_id: "standing_http_challenge",
      manifest_id: "standing_http_manifest",
      status: "pending",
      offer: {
        title: "Prepare the next safe step",
        reason: "A bounded standing workflow is ready.",
        canonical_url: "https://host.example/workflows/standing_http",
      },
      grant_scope: {
        authorization_mode: "standing",
        event_type: "workflow.ready",
        expires_at: "2026-09-10T12:00:00.000Z",
        max_active_activations: 1,
        human_boundary: "A person confirms the final action.",
      },
      issuer_origin: "https://host.example",
      workflow_id: "standing_http_workflow",
      title: "Prepare the next safe step",
      reason: "A bounded standing workflow is ready.",
    },
    connectors: [
      {
        id: "connector_http",
        deviceName: "Studio Mac",
        expiresAt: "2026-09-11T12:00:00.000Z",
      },
    ],
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("shared Consent HTTP boundary", () => {
  test("redirects unauthenticated token requests through the frontend login continuation", async () => {
    const v01Validator = jest
      .spyOn(consentService, "validateConsentPageToken")
      .mockRejectedValue(new ConsentError("consent_token_invalid", 404));
    const standingValidator = jest.spyOn(standingService, "validateStandingConsentPageToken");

    const response = await request(app).get(`/consent?token=${standingToken}`);

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain("/user-login?return_to=");
    expect(response.headers.location).toContain(
      encodeURIComponent(`/consent?token=${standingToken}`),
    );
    expect(v01Validator).toHaveBeenCalledWith(standingToken);
    expect(standingValidator).not.toHaveBeenCalled();
  });

  test("dispatches an authenticated standing token to the bounded renderer without echoing its token", async () => {
    jest
      .spyOn(consentService, "validateConsentPageToken")
      .mockRejectedValue(new ConsentError("consent_token_invalid", 404));
    const standingValidator = jest
      .spyOn(standingService, "validateStandingConsentPageToken")
      .mockResolvedValue(undefined);
    const prompt = jest
      .spyOn(standingService, "getStandingConsentPrompt")
      .mockResolvedValue(standingPrompt());

    const response = await request(app)
      .get(`/consent?token=${standingToken}`)
      .set("Cookie", userCookie("account_http"));

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["cross-origin-opener-policy"]).toBe("unsafe-none");
    expect(response.type).toBe("text/html");
    expect(response.text).toContain("Prepare the next safe step");
    expect(response.text).not.toContain(standingToken);
    expect(standingValidator).toHaveBeenCalledWith(standingToken);
    expect(prompt).toHaveBeenCalledWith(standingToken, "account_http");
  });

  test("maps standing expiry to a bounded HTTP response after authentication", async () => {
    jest
      .spyOn(consentService, "validateConsentPageToken")
      .mockRejectedValue(new ConsentError("consent_token_invalid", 404));
    const standingValidator = jest
      .spyOn(standingService, "validateStandingConsentPageToken")
      .mockRejectedValue(new StandingReceiverError("consent_session_expired", 410));
    const prompt = jest.spyOn(standingService, "getStandingConsentPrompt");

    const response = await request(app)
      .get(`/consent?token=${standingToken}`)
      .set("Cookie", userCookie("account_http"));

    expect(response.status).toBe(410);
    expect(response.body).toEqual({
      error: { code: "consent_session_expired", retryable: false },
    });
    expect(standingValidator).toHaveBeenCalledWith(standingToken);
    expect(prompt).not.toHaveBeenCalled();
  });
});

describe("standing account decision HTTP boundary", () => {
  test("enforces the Receiver-origin and User session before mapping the same-user decision", async () => {
    const service = jest
      .spyOn(standingService, "decideStandingConsentByToken")
      .mockResolvedValue({
        type: "webmcp.reentry_account_consent_decision",
        protocol_version: "0.2",
        consent_session_id: "standing_http_session",
        challenge_id: "standing_http_challenge",
        action: "approve",
        status: "approved",
      } as never);

    const response = await request(app)
      .post("/v0.2/account-consent-decisions")
      .set("Cookie", userCookie("account_http"))
      .set("Origin", appConfig.receiverPublicUrl)
      .set("Content-Type", "application/json")
      .send({
        consent_token: standingToken,
        action: "approve",
        connector_id: "connector_http",
        decision_id: "decision_http",
        decided_at: decisionTimestamp,
      });

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body.status).toBe("approved");
    expect(service).toHaveBeenCalledWith("account_http", {
      consentToken: standingToken,
      action: "approve",
      connectorId: "connector_http",
      decisionId: "decision_http",
      decidedAt: decisionTimestamp,
    });
  });

  test("rejects a decision without the Receiver origin before service dispatch", async () => {
    const service = jest.spyOn(standingService, "decideStandingConsentByToken");

    const response = await request(app)
      .post("/v0.2/account-consent-decisions")
      .set("Cookie", userCookie("account_http"))
      .set("Content-Type", "application/json")
      .send({
        consent_token: standingToken,
        action: "decline",
        decision_id: "decision_http_decline",
        decided_at: decisionTimestamp,
      });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: { code: "csrf_origin_invalid" } });
    expect(service).not.toHaveBeenCalled();
  });
});
