/**
 * Macra — Stripe Customer Portal
 *
 * Vercel Serverless Function
 * Endpoint: POST /api/create-portal-session
 *
 * Creates a Stripe Customer Portal session so users
 * can manage their Macra Pro subscription.
 */

import Stripe from "stripe";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({ error: "Stripe not configured" });
  }

  const stripe = new Stripe(secretKey);

  try {
    const { customerId } = req.body;
    if (!customerId) {
      return res.status(400).json({ error: "Missing customerId" });
    }

    const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, "") || "http://localhost:5173";

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Portal session error:", err);
    res.status(500).json({ error: err.message });
  }
}
