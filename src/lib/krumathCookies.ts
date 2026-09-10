import type { CookieOptionsWithName } from "@supabase/ssr";

const KRUMATH_COOKIE_DOMAIN = ".krumath.com";

/** Cookie options shared with KruMath so auth SSO works on krumath.com. */
export function getKrumathCookieOptions(
  hostname = typeof window !== "undefined" ? window.location.hostname : "",
): Pick<CookieOptionsWithName, "domain" | "path" | "sameSite" | "secure"> {
  const onKrumath =
    hostname === "krumath.com" || hostname.endsWith(".krumath.com");

  if (onKrumath) {
    return {
      domain: KRUMATH_COOKIE_DOMAIN,
      path: "/",
      sameSite: "lax",
      secure: true,
    };
  }

  // localhost / preview: leave domain unset so cookies stay on this origin
  return {
    path: "/",
    sameSite: "lax",
    secure: false,
  };
}
