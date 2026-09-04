import {
  createTestContext,
  getApprovedContinuation,
  readExactJson,
  testErrorResponse,
  testJson,
} from "../../../_lib/reentry-test.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await readExactJson(request, ["continuation_id"]);
    const { reentry } = createTestContext();
    const continuation = getApprovedContinuation(body.continuation_id);
    const acceptance = await reentry.trigger(continuation);

    return testJson(202, {
      status: acceptance.status,
      event_id: acceptance.event_id,
      duplicate: acceptance.duplicate,
    });
  } catch (error) {
    return testErrorResponse(error);
  }
}
