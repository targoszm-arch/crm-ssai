import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  /** Sits on the same line as the title on wide screens. Filters, not actions —
      actions go in <PageActions> and portal into the top bar. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * The title block at the top of every page.
 *
 * Every page hand-wrote this and there were five versions of it —
 * `text-3xl font-bold`, `text-2xl font-bold`, `text-2xl font-semibold`,
 * `text-xl md:text-2xl font-semibold` and `text-lg font-semibold` — so the
 * heading changed size when you moved between pages and nothing lined up
 * vertically. One component, one scale.
 */
export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}
