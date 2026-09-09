import { createContext, useContext, type ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useLocaleState } from "@/hooks/use-locale";
import type { EnKey, Locale, MessageParams } from "@/lib/i18n";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: EnKey, params?: MessageParams) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const value = useLocaleState();
  return (
    <TooltipProvider delayDuration={350} skipDelayDuration={0}>
      <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
    </TooltipProvider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}
