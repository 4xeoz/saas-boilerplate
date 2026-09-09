import { createSign, randomUUID } from "node:crypto";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
let cached: { token: string; expiresAt: number } | null = null;

type ServiceAccount = { client_email?: string; private_key?: string };

function config() {
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim();
  if (!rootFolderId) throw new Error("Google Drive root folder is not configured.");
  const accessToken = process.env.GOOGLE_DRIVE_ACCESS_TOKEN?.trim();
  if (accessToken) return { rootFolderId, accessToken };
  let json: ServiceAccount = {};
  if (process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON) {
    try { json = JSON.parse(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON) as ServiceAccount; } catch { throw new Error("Google Drive service account JSON is invalid."); }
  }
  const email = json.client_email || process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = (json.private_key || process.env.GOOGLE_DRIVE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!email || !privateKey) throw new Error("Google Drive credentials are not configured.");
  return { rootFolderId, email, privateKey };
}

async function accessToken(value: ReturnType<typeof config>) {
  if ("accessToken" in value) return value.accessToken;
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claim = Buffer.from(JSON.stringify({ iss: value.email, scope: DRIVE_SCOPE, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })).toString("base64url");
  const unsigned = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const assertion = `${unsigned}.${signer.sign(value.privateKey).toString("base64url")}`;
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }), cache: "no-store" });
  if (!response.ok) throw new Error("Google Drive authentication failed.");
  const data = await response.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("Google Drive returned no access token.");
  cached = { token: data.access_token, expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000 };
  return data.access_token;
}

export async function uploadToDrive(input: { name: string; mimeType: string; body: Buffer }) {
  const drive = config();
  const token = await accessToken(drive);
  const boundary = `northstar-${randomUUID()}`;
  const metadata = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: input.name, parents: [drive.rootFolderId] })}\r\n--${boundary}\r\nContent-Type: ${input.mimeType}\r\n\r\n`);
  const ending = Buffer.from(`\r\n--${boundary}--`);
  const response = await fetch(`${UPLOAD_API}?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,size,webViewLink`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body: Buffer.concat([metadata, input.body, ending]) as unknown as BodyInit, cache: "no-store" });
  if (!response.ok) throw new Error(`Google Drive upload failed (${response.status}).`);
  const file = await response.json() as { id?: string; name?: string; mimeType?: string; size?: string; webViewLink?: string };
  if (!file.id) throw new Error("Google Drive returned no file id.");
  return file;
}
