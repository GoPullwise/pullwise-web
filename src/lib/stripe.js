import { loadStripe } from "@stripe/stripe-js";
import { env } from "../config/env.js";

let stripePromise;

export function getStripe() {
  if (!env.VITE_STRIPE_PUBLISHABLE_KEY) {
    throw new Error("VITE_STRIPE_PUBLISHABLE_KEY is not configured.");
  }

  if (!stripePromise) {
    stripePromise = loadStripe(env.VITE_STRIPE_PUBLISHABLE_KEY);
  }

  return stripePromise;
}
