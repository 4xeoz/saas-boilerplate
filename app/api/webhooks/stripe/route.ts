import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/prisma/prisma";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!signature || !secret) return NextResponse.json({ error: "Webhook is not configured." }, { status: 400 });
  try {
    const event = getStripe().webhooks.constructEvent(await request.text(), signature, secret);
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const organizationId = session.metadata?.organizationId;
      if (organizationId && typeof session.subscription === "string") await prisma.subscription.update({ where: { organizationId }, data: { stripeSubscriptionId: session.subscription, status: "ACTIVE", plan: "PRO" } });
    }
    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const mapped = subscription.status === "active" ? "ACTIVE" : subscription.status === "trialing" ? "TRIALING" : subscription.status === "past_due" ? "PAST_DUE" : subscription.status === "canceled" ? "CANCELED" : subscription.status === "unpaid" ? "UNPAID" : "INCOMPLETE";
      await prisma.subscription.updateMany({ where: { stripeSubscriptionId: subscription.id }, data: { status: mapped, plan: mapped === "CANCELED" ? "FREE" : "PRO", currentPeriodEnd: subscription.items.data[0]?.current_period_end ? new Date(subscription.items.data[0].current_period_end * 1000) : null } });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid webhook." }, { status: 400 });
  }
}
