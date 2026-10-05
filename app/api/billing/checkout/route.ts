import { NextResponse } from "next/server";
import { prisma } from "@/prisma/prisma";
import { getStripe } from "@/lib/stripe";
import { getMembership } from "@/lib/membership";
import { canManageWorkspace } from "@/lib/permissions";

export async function POST() {
  const context = await getMembership();
  if (!context) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!canManageWorkspace(context.membership.role)) return NextResponse.json({ error: "Only workspace admins can change the plan." }, { status: 403 });
  const priceId = process.env.STRIPE_PRO_PRICE_ID?.trim();
  if (!priceId) return NextResponse.json({ error: "Stripe is not configured. Add STRIPE_PRO_PRICE_ID to .env.local." }, { status: 503 });

  try {
    const stripe = getStripe();
    const organization = await prisma.organization.findUnique({ where: { id: context.membership.organizationId }, include: { subscription: true } });
    if (!organization) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
    let customerId = organization.subscription?.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ name: organization.name, metadata: { organizationId: organization.id } });
      customerId = customer.id;
      await prisma.subscription.upsert({ where: { organizationId: organization.id }, update: { stripeCustomerId: customerId }, create: { organizationId: organization.id, stripeCustomerId: customerId, plan: "FREE", status: "INCOMPLETE" } });
    }
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const checkout = await stripe.checkout.sessions.create({ mode: "subscription", customer: customerId, line_items: [{ price: priceId, quantity: 1 }], success_url: `${baseUrl}/app/billing?success=1`, cancel_url: `${baseUrl}/app/billing?cancelled=1`, metadata: { organizationId: organization.id } });
    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    // Stripe errors can describe account configuration; keep them in server logs only.
    console.error("Checkout failed", error);
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }
}
