import * as React from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-[var(--color-muted)]">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`px-8 py-6 ${className ?? ""}`}>{children}</div>;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 text-center">
      {icon && <div className="mb-3 text-3xl">{icon}</div>}
      <h3 className="text-base font-medium text-zinc-900">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-[var(--color-muted)]">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
