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
 * The inbox and the deals kanban are capped like everything else. They were
 * exempt for one release on the theory that a sideways-scanned layout wants the
 * whole screen; consistency won, so don't reintroduce a bleed prop.
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
          <main className="flex min-h-0 flex-1 flex-col overflow-auto">
            <div className="mx-auto flex w-full min-h-0 max-w-[1200px] flex-1 flex-col px-4 py-6 md:px-6">
              {children}
            </div>
          </main>
        </SidebarInset>
      </PageActionsProvider>
    </SidebarProvider>
  );
}
