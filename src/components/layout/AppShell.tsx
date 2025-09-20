
import { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import MobileNavigation from "./MobileNavigation";
import { useIsMobile } from "@/hooks/use-mobile";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="flex min-h-screen flex-col">
      <MobileNavigation 
        isOpen={isMobileNavOpen} 
        onClose={() => setIsMobileNavOpen(false)} 
      />
      <div className="flex flex-1">
        {!isMobile && <Sidebar />}
        <div className="flex flex-1 flex-col">
          <Header onMenuToggle={() => setIsMobileNavOpen(true)} />
          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
