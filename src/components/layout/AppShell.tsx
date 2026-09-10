import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { AppSidebar } from "./AppSidebar";
import Header from "./Header";
import { PageActionsProvider } from "./PageActions";

interface AppShellProps {
  children: React.ReactNode;
  /**
   * Pages that own the whole viewport: the inbox's three columns and the deals
   * kanban are read by scanning sideways, and a 1200px cap would put empty
   * margin either side of the thing you came to look at.
   */
  fullBleed?: boolean;
}

/**
 * One shell for every page.
 *
 * Pages used to bring their own outer wrapper and there were five different
 * ones — `container`, `container max-w-7xl`, a bare `py-6`, a `w-full` with its
 * own padding, and three pages with nothing at all — so moving between them
 * shifted the content sideways and changed the gutter. The width and the
 * padding live here now; a page renders its content and nothing else.
 */
export default function AppShell({ children, fullBleed = false }: AppShellProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <PageActionsProvider>
        <AppSidebar />
        <SidebarInset>
          <Header />
          <main className={cn("flex-1 overflow-auto", fullBleed && "flex flex-col")}>
            {fullBleed ? (
              children
            ) : (
              <div className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-6">
                {children}
              </div>
            )}
          </main>
        </SidebarInset>
      </PageActionsProvider>
    </SidebarProvider>
  );
}
