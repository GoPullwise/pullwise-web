import { z } from "zod";

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().url().optional(),
  VITE_APP_URL: z.string().url().optional(),
  VITE_GITHUB_APP_SLUG: z.string().optional(),
  VITE_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
});

export const env = envSchema.parse(import.meta.env);
