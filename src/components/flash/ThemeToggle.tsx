import { Moon, Sun } from "lucide-react";

import { useLocale } from "@/components/i18n/LocaleProvider";
import { useTheme } from "@/hooks/use-theme";
import { IconTooltip } from "./IconTooltip";

const iconBtnClass =
  "inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-[0.96]";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLocale();
  const isDark = theme === "dark";

  return (
    <IconTooltip label={isDark ? t("theme.light") : t("theme.dark")} side="bottom">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? t("theme.toLight") : t("theme.toDark")}
        aria-pressed={isDark}
        className={`${iconBtnClass} ${className}`}
      >
        {isDark ? (
          <Moon
            className="size-4 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none"
            strokeWidth={1.75}
            aria-hidden
          />
        ) : (
          <Sun
            className="size-4 text-primary transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none"
            strokeWidth={1.75}
            aria-hidden
          />
        )}
        <span className="sr-only">{isDark ? t("theme.darkShort") : t("theme.lightShort")}</span>
      </button>
    </IconTooltip>
  );
}
