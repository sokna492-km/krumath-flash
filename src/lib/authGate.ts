import { createBrowserClient } from "@supabase/ssr";
import { createClientOnlyFn } from "@tanstack/react-start";

import { getKrumathCookieOptions } from "@/lib/krumathCookies";
import { APP_SLUG_PATH, getSignInUrl } from "@/lib/krumathUrls";

/**
 * Soft gate for gated actions (Stats).
 * DEV: always allow. Production: require a real (non-anonymous) Supabase user.
 *
 * Kept free of `*.client.ts` imports so TanStack Start SSR import-protection passes.
 */
export const requireSignedInForAction = createClientOnlyFn(async (): Promise<boolean> => {
  if (import.meta.env.DEV) return true;

  const url = import.meta.env["VITE_SUPABASE_URL"];
  const key = import.meta.env["VITE_SUPABASE_ANON_KEY"];
  if (!url || !key || typeof url !== "string" || typeof key !== "string") {
    window.location.assign(getSignInUrl(APP_SLUG_PATH));
    return false;
  }

  const supabase = createBrowserClient(url, key, {
    cookieOptions: getKrumathCookieOptions(),
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.is_anonymous === true) {
    window.location.assign(getSignInUrl(APP_SLUG_PATH));
    return false;
  }

  return true;
});
