import { NextResponse } from "next/server";
import crypto from "crypto";
import { recordPayment } from "@/lib/payments";

// Authoritative server-to-server confirmation from Razorpay. Configure this URL
// as a webhook in the Razorpay dashboard (events: payment.captured) with the
// secret you set in RAZORPAY_WEBHOOK_SECRET. Unlike /verify this fires even if
// the user closes the tab before the browser handler runs.
//
// IMPORTANT: signature is computed over the RAW request body, so we read it with
// req.text() and never JSON.parse before verifying.
export async function POST(req: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }

  const signature = req.headers.get("x-razorpay-signature") ?? "";
  const raw = await req.text();

  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  const valid =
    sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: {
    event?: string;
    payload?: {
      payment?: {
        entity?: {
          id?: string;
          order_id?: string;
          amount?: number;
          currency?: string;
          email?: string;
          notes?: Record<string, string>;
        };
      };
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad payload." }, { status: 400 });
  }

  if (event.event === "payment.captured") {
    const entity = event.payload?.payment?.entity;
    const notes = entity?.notes ?? {};
    if (notes.userId && notes.plan && entity?.id) {
      try {
        await recordPayment({
          userId: notes.userId,
          email: entity.email ?? null,
          orderId: entity.order_id ?? "",
          paymentId: entity.id,
          plan: notes.plan,
          cycle: notes.cycle ?? null,
          amount: entity.amount ?? 0,
          currency: entity.currency ?? "INR",
        });
      } catch (err) {
        console.error("[razorpay/webhook] record failed", err);
      }
    }
  }

  // Always 200 on a valid signature so Razorpay doesn't retry events we chose to
  // ignore (anything other than payment.captured).
  return NextResponse.json({ received: true });
}
