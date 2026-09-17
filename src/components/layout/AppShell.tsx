import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import Header from "./Header";
import { PageActionsProvider } from "./PageActions";

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * One shell for every page. No exceptions.
 *
 * Pages used to bring their own outer wrapper and there were five different
 * ones — `container`, `container max-w-7xl`, a bare `py-6`, a `w-full` with its
 * own padding, and three pages with nothing at all — so moving between them
 * shifted the content sideways and changed the gutter. The width and the
 * padding live here now; a page renders its content and nothing else.
 *
 * Every page fills the screen with a 16px gutter. There is no max width:
 * a centred column was tried for one release and left a screen's worth of
 * empty margin either side of the content. Don't reintroduce one.
 *
 * The chain from the viewport down is a column with a real height —
 * `h-svh` on the inset, `min-h-0 flex-1` on main and on the container — so a
 * page that wants to fill the screen can say `flex-1 min-h-0` and have it mean
 * something. Without a definite height at the top, `h-full` further down
 * resolves to nothing.
 */
export default function AppShell({ children }: AppShellProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <PageActionsProvider>
        <AppSidebar />
        <SidebarInset className="h-svh min-h-svh overflow-hidden">
          <Header />
          <main className="@container/main flex min-h-0 flex-1 flex-col overflow-auto">
            {/* Rhythm, not decoration.
                - py-4 md:py-6 vertically, px-4 lg:px-6 horizontally: the same
                  scale the header already uses, so content lines up with the
                  title above it instead of sitting on its own grid.
                - gap-4 md:gap-6 so a page never has to invent its own spacing
                  between sections; pages that set their own gap still win.
                - @container/main names this box so children can size against
                  the CONTENT width. With a collapsible sidebar that is 240px
                  different from the viewport, which is why `lg:grid-cols-4`
                  reflows at the wrong moment and `@5xl/main:grid-cols-4`
                  does not. */}
            <div className="flex min-h-0 w-full flex-1 flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
              {children}
            </div>
          </main>
        </SidebarInset>
      </PageActionsProvider>
    </SidebarProvider>
  );
}
