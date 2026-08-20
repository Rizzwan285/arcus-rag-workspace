/**
 * Arcus UI primitives.
 *
 * Deliberately small: a button, a hairline panel, a status dot, a metric
 * readout, and a few layout helpers. Everything else is composed from these in
 * the pages, so there is one place to change how the interface feels.
 */

import Link from "next/link";
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────────
   Button
   Solid = the one primary action on a view. Everything else is outline
   or ghost, so the eye always finds the primary immediately.
   ──────────────────────────────────────────────────────────────────── */

type ButtonVariant = "solid" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium " +
  "transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 " +
  "whitespace-nowrap";

const buttonVariants: Record<ButtonVariant, string> = {
  solid:
    "bg-surface-900 text-white hover:bg-surface-800 active:bg-surface-950",
  outline:
    "border border-line-strong bg-surface-0 text-surface-700 hover:bg-surface-50 hover:text-surface-900",
  ghost: "text-surface-500 hover:bg-surface-100 hover:text-surface-900",
  danger:
    "border border-red-200 bg-surface-0 text-err hover:bg-err-soft",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-9 px-3.5 text-sm",
  lg: "h-11 px-5 text-base",
};

interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({
  variant = "outline",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}

interface ButtonLinkProps extends ComponentPropsWithoutRef<typeof Link> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function ButtonLink({
  variant = "outline",
  size = "md",
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...props}
    >
      {children}
    </Link>
  );
}

/* ────────────────────────────────────────────────────────────────────
   Panel — the only container. Depth comes from hairlines, not shadows.
   ──────────────────────────────────────────────────────────────────── */

export function Panel({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn("panel", className)} {...props}>
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-line px-4 py-3",
        className
      )}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-surface-900">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs text-surface-500">{description}</p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   Page header — a title, a line of context, and the page's actions.
   ──────────────────────────────────────────────────────────────────── */

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 font-mono text-2xs tracking-[0.12em] text-surface-400 uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl text-surface-900">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-surface-500">{description}</p>
        )}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </header>
  );
}

/* ────────────────────────────────────────────────────────────────────
   Status — a dot plus a word. Colour carries meaning; nothing else does.
   ──────────────────────────────────────────────────────────────────── */

export type StatusTone = "ok" | "busy" | "warn" | "err" | "idle";

const statusDot: Record<StatusTone, string> = {
  ok: "bg-ok",
  busy: "bg-busy animate-status-pulse",
  warn: "bg-warn",
  err: "bg-err",
  idle: "bg-surface-300",
};

const statusText: Record<StatusTone, string> = {
  ok: "text-ok",
  busy: "text-busy",
  warn: "text-warn",
  err: "text-err",
  idle: "text-surface-400",
};

export function StatusDot({
  tone,
  className,
}: {
  tone: StatusTone;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", statusDot[tone], className)}
      aria-hidden
    />
  );
}

export function Status({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", statusText[tone], className)}>
      <StatusDot tone={tone} />
      {children}
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────────
   Tag — a quiet label for counts, kinds, and provenance.
   ──────────────────────────────────────────────────────────────────── */

export function Tag({
  children,
  mono = false,
  className,
}: {
  children: ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border border-line bg-surface-50 px-1.5 py-0.5 text-2xs text-surface-500",
        mono && "font-mono tabular",
        className
      )}
    >
      {children}
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────────
   Metric — the core readout. Label above, monospaced figure below.
   ──────────────────────────────────────────────────────────────────── */

export function Metric({
  label,
  value,
  unit,
  hint,
  tone,
  loading = false,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  hint?: ReactNode;
  tone?: StatusTone;
  loading?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-center gap-1.5">
        {tone && <StatusDot tone={tone} />}
        <p className="truncate font-mono text-2xs tracking-[0.1em] text-surface-400 uppercase">
          {label}
        </p>
      </div>
      {loading ? (
        <div className="mt-2 h-7 w-16 rounded bg-surface-100" />
      ) : (
        <p className="mt-1 flex items-baseline gap-1 font-mono text-2xl tabular text-surface-900">
          {value}
          {unit && (
            <span className="text-sm font-normal text-surface-400">{unit}</span>
          )}
        </p>
      )}
      {hint && <p className="mt-0.5 text-xs text-surface-400">{hint}</p>}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   Field — a label/value row for detail lists.
   ──────────────────────────────────────────────────────────────────── */

export function Field({
  label,
  children,
  mono = true,
}: {
  label: ReactNode;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="shrink-0 text-xs text-surface-400">{label}</dt>
      <dd
        className={cn(
          "min-w-0 truncate text-right text-xs text-surface-700",
          mono && "font-mono tabular"
        )}
      >
        {children}
      </dd>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   EmptyState — hatched, understated, always offers the next action.
   ──────────────────────────────────────────────────────────────────── */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ElementType;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-line-strong px-6 py-14 text-center",
        className
      )}
    >
      {Icon && (
        <div className="hatch mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-line">
          <Icon className="h-5 w-5 text-surface-400" strokeWidth={1.5} />
        </div>
      )}
      <p className="text-sm font-medium text-surface-800">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-surface-500">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   Skeleton + progress
   ──────────────────────────────────────────────────────────────────── */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-surface-100", className)} />;
}

/** Indeterminate bar for work whose duration is unknown. */
export function IndeterminateBar({ className }: { className?: string }) {
  return (
    <div className={cn("h-0.5 w-full overflow-hidden rounded-full bg-surface-100", className)}>
      <div className="animate-slide h-full w-1/4 rounded-full bg-arcus-500" />
    </div>
  );
}

/** Determinate bar, for uploads where progress is known. */
export function ProgressBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <div className={cn("h-0.5 w-full overflow-hidden rounded-full bg-surface-100", className)}>
      <div
        className="h-full rounded-full bg-surface-900 transition-[width] duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   SectionLabel — a small ruled caption above a group.
   ──────────────────────────────────────────────────────────────────── */

export function SectionLabel({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <h2 className="font-mono text-2xs tracking-[0.12em] text-surface-400 uppercase">
        {children}
      </h2>
      {action}
    </div>
  );
}
