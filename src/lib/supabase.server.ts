import { createServerClient, parseCookieHeader, type CookieOptions } from "@supabase/ssr";
import { getRequestHeader, getResponse, setCookie } from "@tanstack/react-start/server";

import { getKrumathCookieOptions } from "@/lib/krumathCookies";

function requireEnv(name: "VITE_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY"): string {
  const value = import.meta.env[name];
  if (!value || typeof value !== "string") {
    throw new Error(`Missing ${name}. Copy .env.example and set Supabase credentials.`);
  }
  return value;
}

/**
 * Server Supabase client for SSR / server fns.
 * Soft-gate helpers that need the browser session live in supabase.client + authGate.client.
 */
export function createSupabaseServerClient() {
  const cookieHeader = getRequestHeader("cookie") ?? "";
  const hostname =
    getRequestHeader("x-forwarded-host") ?? getRequestHeader("host") ?? "";
  const hostOnly = hostname.split(":")[0] ?? "";
  const cookieOptions = getKrumathCookieOptions(hostOnly);

  return createServerClient(requireEnv("VITE_SUPABASE_URL"), requireEnv("VITE_SUPABASE_ANON_KEY"), {
    cookieOptions,
    cookies: {
      getAll() {
        return parseCookieHeader(cookieHeader).map(({ name, value }) => ({
          name,
          value: value ?? "",
        }));
      },
      setAll(cookiesToSet) {
        // Only mutate when a response is available (e.g. during request middleware).
        try {
          getResponse();
        } catch {
          return;
        }
        for (const { name, value, options } of cookiesToSet) {
          setCookie(name, value, { ...cookieOptions, ...(options as CookieOptions) });
        }
      },
    },
  });
}
