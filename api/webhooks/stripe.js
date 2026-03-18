/**
 * Macra — Stripe Webhook Handler
 * 
 * Vercel Serverless Function
 * Endpoint: POST /api/webhooks/stripe
 * 
 * Listens for Stripe subscription events and updates
 * the user's Pro status in Supabase.
 * 
 * Deploy: This file lives at /api/webhooks/stripe.js
 * in your Vercel project root.
 */

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role key server-side
);

// Disable body parsing — Stripe needs the raw body
export const config = {
  api: { bodyParser: false },
};

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rawBody = await getRawBody(req);
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: "Invalid signature" });
  }

  // Handle subscription events
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const customerId = session.customer;

      if (userId) {
        await supabase.from("profiles").update({
          is_pro: true,
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        }).eq("id", userId);
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const customerId = subscription.customer;
      const isActive = ["active", "trialing"].includes(subscription.status);

      await supabase.from("profiles").update({
        is_pro: isActive,
        updated_at: new Date().toISOString(),
      }).eq("stripe_customer_id", customerId);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const customerId = subscription.customer;

      await supabase.from("profiles").update({
        is_pro: false,
        updated_at: new Date().toISOString(),
      }).eq("stripe_customer_id", customerId);
      break;
    }
  }

  res.json({ received: true });
}
