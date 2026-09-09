import { CreditCard, ShieldCheck } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/prisma/prisma";
import { CheckoutButton } from "@/components/checkout-button";

export const metadata = { title: "Billing" };

export default async function BillingPage() {
  const session = await auth();
  const subscription = session?.user.organizationId ? await prisma.subscription.findUnique({ where: { organizationId: session.user.organizationId } }) : null;
  return <div><div className="content-header"><div><span className="eyebrow">Workspace plan</span><h2>Billing.</h2><p>Stripe handles checkout and recurring billing; your app stores only the subscription state it needs.</p></div></div><div className="two-column"><section className="panel"><span className="feature-icon"><CreditCard size={19} /></span><h3 style={{ marginTop: 22 }}>Current plan: {subscription?.plan || "FREE"}</h3><p className="panel-subtitle">Status: {subscription?.status?.toLowerCase() || "not started"}{subscription?.currentPeriodEnd ? ` · renews ${subscription.currentPeriodEnd.toLocaleDateString()}` : ""}</p><CheckoutButton /></section><section className="panel"><span className="feature-icon"><ShieldCheck size={19} /></span><h3 style={{ marginTop: 22 }}>Billing boundaries</h3><ul className="check-list"><li>Checkout is created only for the signed-in workspace.</li><li>Webhook signatures are verified before updates.</li><li>No card details are stored in this database.</li></ul></section></div></div>;
}
