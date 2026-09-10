/** App path on krumath.com (no trailing slash). */
export const APP_SLUG_PATH = "/krumath-flash";

function krumathOrigin(): string {
  const origin = import.meta.env["VITE_KRUMATH_ORIGIN"];
  return typeof origin === "string" ? origin.replace(/\/$/, "") : "";
}

/** KruMath home — relative on production, absolute when VITE_KRUMATH_ORIGIN is set. */
export function getHomeUrl(): string {
  const origin = krumathOrigin();
  return origin ? `${origin}/home` : "/home";
}

/** KruMath sign-in with returnUrl back to this feature. */
export function getSignInUrl(returnPath: string = APP_SLUG_PATH): string {
  const path = returnPath.startsWith("/") ? returnPath : `/${returnPath}`;
  const qs = `returnUrl=${encodeURIComponent(path)}`;
  const origin = krumathOrigin();
  return origin ? `${origin}/sign-in?${qs}` : `/sign-in?${qs}`;
}
