import { useLocale } from "@/components/i18n/LocaleProvider";
import { IconTooltip } from "./IconTooltip";

export function LocaleToggle({ className = "" }: { className?: string }) {
  const { locale, toggleLocale, t } = useLocale();
  const isKm = locale === "km";

  return (
    <IconTooltip
      label={isKm ? t("settings.lang.en") : t("settings.lang.km")}
      side="bottom"
    >
      <button
        type="button"
        onClick={toggleLocale}
        aria-label={isKm ? t("nav.switchToEn") : t("nav.switchToKm")}
        aria-pressed={isKm}
        className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-[0.96] ${className}`}
      >
        <span
          className="text-[12px] font-semibold leading-none tracking-wide"
          style={isKm ? undefined : { fontFamily: '"Kantumruy Pro", sans-serif' }}
        >
          {isKm ? "EN" : "ខ្មែរ"}
        </span>
      </button>
    </IconTooltip>
  );
}
