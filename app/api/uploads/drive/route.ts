import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/prisma/prisma";
import { uploadToDrive } from "@/lib/drive";

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.organizationId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const form = await request.formData();
  const projectId = String(form.get("projectId") || "");
  const file = form.get("file");
  if (!(file instanceof File) || !projectId) return NextResponse.json({ error: "A project and file are required." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Files must be smaller than 25 MB." }, { status: 413 });

  const project = await prisma.project.findFirst({ where: { id: projectId, organizationId: session.user.organizationId } });
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  try {
    const uploaded = await uploadToDrive({ name: file.name, mimeType: file.type || "application/octet-stream", body: Buffer.from(await file.arrayBuffer()) });
    const asset = await prisma.asset.create({ data: { organizationId: session.user.organizationId, projectId: project.id, uploadedById: session.user.id, name: uploaded.name || file.name, mimeType: uploaded.mimeType || file.type || "application/octet-stream", size: Number(uploaded.size || file.size), driveFileId: uploaded.id, driveUrl: uploaded.webViewLink || `https://drive.google.com/open?id=${uploaded.id}` } });
    return NextResponse.json({ file: asset });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 503 });
  }
}
