import { en, type EnKey } from "./en";
import { km } from "./km";
import type { Locale, MessageParams } from "./types";

export type { Locale, MessageParams, EnKey };
export { en, km };

export const LOCALE_STORAGE_KEY = "krumath-flash-locale";
export const LOCALES: Locale[] = ["en", "km"];

const dictionaries: Record<Locale, Record<EnKey, string>> = { en, km };

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "km";
}

export const DEFAULT_LOCALE: Locale = "km";

export function detectLocale(): Locale {
  return DEFAULT_LOCALE;
}

export function readStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

export function applyDocumentLocale(locale: Locale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
}

export function applyDocumentMeta(locale: Locale) {
  if (typeof document === "undefined") return;
  document.title = translate(locale, "meta.title");
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute("content", translate(locale, "meta.description"));
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute("content", translate(locale, "meta.title"));
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute("content", translate(locale, "meta.description"));
}

function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    params[key] !== undefined ? String(params[key]) : `{${key}}`,
  );
}

export function translate(locale: Locale, key: EnKey, params?: MessageParams): string {
  const dict = dictionaries[locale] ?? en;
  const template = dict[key] ?? en[key] ?? key;
  return interpolate(template, params);
}

export function formatNumber(locale: Locale, value: number): string {
  // Keep Western digits; only apply locale grouping rules.
  return value.toLocaleString(locale === "km" ? "km-KH" : "en-US", {
    numberingSystem: "latn",
  });
}
