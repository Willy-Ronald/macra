/**
 * Macra — Stripe Checkout Session
 *
 * Vercel Serverless Function
 * Endpoint: POST /api/create-checkout-session
 *
 * Creates a Stripe Checkout session for Macra Pro subscription.
 */

import Stripe from "stripe";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;

  if (!secretKey || !priceId) {
    return res.status(500).json({ error: "Stripe not configured" });
  }

  const stripe = new Stripe(secretKey);

  try {
    const { userId, email } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, "") || "http://localhost:5173";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email || undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancel`,
      metadata: { userId },
    });

    res.json({ sessionId: session.id });
  } catch (err) {
    console.error("Checkout session error:", err);
    res.status(500).json({ error: err.message });
  }
}
