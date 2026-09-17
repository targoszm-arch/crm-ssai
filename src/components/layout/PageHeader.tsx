import { cn } from "@/lib/utils";
import { PageTitlePortal } from "./PageActions";

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
    <>
      {/* Title and description go to the top bar. The description is hidden on
          narrow screens rather than wrapping the bar onto a second line. */}
      <PageTitlePortal>
        <h1 className="truncate text-base font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="hidden truncate text-sm text-muted-foreground lg:block">
            {description}
          </p>
        )}
      </PageTitlePortal>

      {/* Only the page's own controls stay in the page. When there are none
          this renders nothing at all, so a page costs no vertical space just
          for having a name. */}
      {children ? (
        <div className={cn("flex flex-wrap items-center gap-3", className)}>{children}</div>
      ) : null}
    </>
  );
}
