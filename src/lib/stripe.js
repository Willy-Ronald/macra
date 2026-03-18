/**
 * Macra — Stripe Integration
 * 
 * Handles Pro subscription checkout and portal.
 * 
 * Setup:
 * 1. Create Stripe account
 * 2. Create "Macra Pro" product ($4.99/mo)
 * 3. Add keys to .env.local
 * 4. Set up webhook endpoint (see README)
 */

import { loadStripe } from "@stripe/stripe-js";

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

/**
 * Redirect user to Stripe Checkout for Pro subscription
 * This calls a Vercel serverless function that creates the session
 */
export async function redirectToCheckout(userId, email) {
  try {
    // Call your API route to create a checkout session
    const response = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, email }),
    });

    const { sessionId, error } = await response.json();
    if (error) throw new Error(error);

    const stripe = await stripePromise;
    if (!stripe) throw new Error("Stripe not loaded");

    const { error: redirectError } = await stripe.redirectToCheckout({ sessionId });
    if (redirectError) throw redirectError;
  } catch (err) {
    console.error("Checkout error:", err);
    throw err;
  }
}

/**
 * Redirect user to Stripe Customer Portal (manage subscription)
 */
export async function redirectToPortal(stripeCustomerId) {
  try {
    const response = await fetch("/api/create-portal-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: stripeCustomerId }),
    });

    const { url, error } = await response.json();
    if (error) throw new Error(error);

    window.location.href = url;
  } catch (err) {
    console.error("Portal error:", err);
    throw err;
  }
}
