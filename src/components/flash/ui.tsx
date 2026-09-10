import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { IconTooltip } from "./IconTooltip";

type Variant = "primary" | "ghost" | "quiet";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:brightness-105 active:brightness-95 shadow-[0_0_0_1px_rgba(0,0,0,0.15)]",
  ghost:
    "bg-secondary text-secondary-foreground hover:bg-muted border border-border",
  quiet:
    "bg-transparent text-muted-foreground hover:text-foreground hover:bg-secondary",
};

export function Btn({
  variant = "ghost",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...rest}
      className={`inline-flex cursor-pointer select-none items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Chip({
  active,
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...rest}
      aria-pressed={active}
      className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-muted-foreground hover:text-foreground"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Overlay({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useLocale();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="overlay-scroll max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border bg-surface p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:rounded-2xl sm:pb-6 md:max-w-lg"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <IconTooltip label={t("action.close")} side="left">
            <button
              type="button"
              onClick={onClose}
              aria-label={t("action.close")}
              className="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              ✕
            </button>
          </IconTooltip>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-stretch gap-2 border-b border-border/60 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-2 sm:justify-end">{children}</div>
    </div>
  );
}
