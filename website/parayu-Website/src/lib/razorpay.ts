import Razorpay from "razorpay";

// Lazily build the Razorpay server SDK from env so a missing key doesn't break
// the build — it only errors when a payment route is actually hit. The secret
// stays server-side; the browser only ever receives the public key id.

let instance: Razorpay | null = null;

export function razorpay(): Razorpay {
  if (instance) return instance;

  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error(
      "Razorpay is not configured: set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."
    );
  }

  instance = new Razorpay({ key_id, key_secret });
  return instance;
}
