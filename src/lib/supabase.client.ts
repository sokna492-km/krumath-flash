import { createBrowserClient } from "@supabase/ssr";

import { getKrumathCookieOptions } from "@/lib/krumathCookies";

function requireEnv(name: "VITE_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY"): string {
  const value = import.meta.env[name];
  if (!value || typeof value !== "string") {
    throw new Error(`Missing ${name}. Copy .env.example and set Supabase credentials.`);
  }
  return value;
}

/** Browser Supabase client — shares KruMath cookies on .krumath.com. */
export function createSupabaseBrowserClient() {
  return createBrowserClient(requireEnv("VITE_SUPABASE_URL"), requireEnv("VITE_SUPABASE_ANON_KEY"), {
    cookieOptions: getKrumathCookieOptions(),
  });
}
