import { auth } from "@/lib/auth";
import { prisma } from "@/prisma/prisma";

// The session JWT outlives role changes and removals, so workspace access is
// always re-checked against the database instead of trusting token claims.
export async function getMembership() {
  const session = await auth();
  if (!session?.user?.id || !session.user.organizationId) return null;
  const membership = await prisma.organizationMember.findUnique({
    where: { userId_organizationId: { userId: session.user.id, organizationId: session.user.organizationId } },
    include: { organization: true },
  });
  return membership ? { session, membership } : null;
}
