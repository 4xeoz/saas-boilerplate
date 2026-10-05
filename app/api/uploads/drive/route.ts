import { NextResponse } from "next/server";
import { prisma } from "@/prisma/prisma";
import { uploadToDrive } from "@/lib/drive";
import { getMembership } from "@/lib/membership";

const MAX_BYTES = 25 * 1024 * 1024;
// Multipart overhead allowance on top of the file itself.
const MAX_REQUEST_BYTES = MAX_BYTES + 64 * 1024;
const MIME_TYPE = /^[\w.+-]+\/[\w.+-]+$/;

export async function POST(request: Request) {
  const context = await getMembership();
  if (!context) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { session, membership } = context;
  // Reject oversized bodies before buffering them into memory.
  const contentLength = Number(request.headers.get("content-length"));
  if (!contentLength || contentLength > MAX_REQUEST_BYTES) return NextResponse.json({ error: "Files must be smaller than 25 MB." }, { status: 413 });
  const form = await request.formData();
  const projectId = String(form.get("projectId") || "");
  const file = form.get("file");
  if (!(file instanceof File) || !projectId) return NextResponse.json({ error: "A project and file are required." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Files must be smaller than 25 MB." }, { status: 413 });
  // The browser-supplied type is written into the Drive multipart body, so only allow a plain type/subtype.
  const mimeType = MIME_TYPE.test(file.type) ? file.type : "application/octet-stream";

  const project = await prisma.project.findFirst({ where: { id: projectId, organizationId: membership.organizationId } });
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  try {
    const uploaded = await uploadToDrive({ name: file.name, mimeType, body: Buffer.from(await file.arrayBuffer()) });
    const asset = await prisma.asset.create({ data: { organizationId: membership.organizationId, projectId: project.id, uploadedById: session.user.id, name: uploaded.name || file.name, mimeType: uploaded.mimeType || mimeType, size: Number(uploaded.size || file.size), driveFileId: uploaded.id, driveUrl: uploaded.webViewLink || `https://drive.google.com/open?id=${uploaded.id}` } });
    return NextResponse.json({ file: asset });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 503 });
  }
}
