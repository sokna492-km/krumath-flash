import { useCallback, useEffect, useState } from "react";
import {
  LOCALE_STORAGE_KEY,
  applyDocumentLocale,
  applyDocumentMeta,
  readStoredLocale,
  translate,
  type EnKey,
  type Locale,
  type MessageParams,
} from "@/lib/i18n";

export function useLocaleState() {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale());

  useEffect(() => {
    applyDocumentLocale(locale);
    applyDocumentMeta(locale);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      /* ignore */
    }
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((prev) => (prev === "km" ? "en" : "km"));
  }, []);

  const t = useCallback(
    (key: EnKey, params?: MessageParams) => translate(locale, key, params),
    [locale],
  );

  return { locale, setLocale, toggleLocale, t };
}
