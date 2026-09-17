import { cn } from "@/lib/utils";

/**
 * The frame every page sits in.
 *
 * AppShell owns the gutter, but each page still invented its own root and its
 * own rhythm, and there were four of them: `space-y-6 animate-fade-in`,
 * `space-y-6`, `space-y-1`, and `flex min-h-0 flex-1 flex-col` with a private
 * `px-4 md:px-6` header bar bolted inside — which is why a section header on
 * one page sat at a different height from the same header on the next, and
 * why the full-height pages re-added a gutter the shell had already applied.
 *
 * Two shapes, because there are only two:
 *
 *   "stacked" — sections in a column, the page scrolls. Most pages.
 *   "fill"    — the page is as tall as the viewport and something inside it
 *               scrolls instead. Deals, Inbox, Calendar, Finances.
 *
 * A page picks one and renders its sections. It does not set spacing.
 */
export default function PageShell({
  children,
  variant = "stacked",
  className,
}: {
  children: React.ReactNode;
  variant?: "stacked" | "fill";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-6",
        // `flex-1` only on a fill page: on a stacked page it would stretch a
        // short page's last section down the screen to absorb the slack.
        variant === "fill" && "min-h-0 flex-1 gap-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
