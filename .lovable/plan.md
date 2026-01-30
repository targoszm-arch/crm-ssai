
# Collapsible Navigation + Mobile Responsive Screens

## Overview

This implementation will replace the custom sidebar with the shadcn/ui collapsible sidebar and make all screens mobile responsive using Tailwind's mobile-first breakpoints.

---

## Tailwind Breakpoints Reference

| Breakpoint | Width | Usage |
|------------|-------|-------|
| (base) | < 640px | Mobile phones |
| sm | >= 640px | Small phones landscape |
| md | >= 768px | Tablets |
| lg | >= 1024px | Small laptops |
| xl | >= 1280px | Desktop |

---

## Part 1: Create New Collapsible Sidebar

### Create: `src/components/layout/AppSidebar.tsx`

A new sidebar component using shadcn/ui primitives with:
- Collapsible mode (`collapsible="icon"`) for desktop
- Sheet overlay for mobile (built into Sidebar component)
- Tooltips on icons when collapsed
- Active route highlighting using `useLocation`
- Persisted state via cookie (built into SidebarProvider)

```tsx
// Key structure
import { Link, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarFooter, SidebarRail
} from "@/components/ui/sidebar";

// Navigation items from existing Sidebar.tsx
const mainNavItems = [
  { icon: Home, label: "Dashboard", path: "/" },
  { icon: Mail, label: "Inbox", path: "/inbox" },
  { icon: Users, label: "Customers", path: "/customers" },
  // ... remaining items
];

export function AppSidebar() {
  const location = useLocation();
  
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {/* Logo - shows CC when collapsed, full name when expanded */}
        <Link to="/" className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-primary flex items-center justify-center">
            <span className="text-white text-sm font-bold">CC</span>
          </div>
          <span className="group-data-[collapsible=icon]:hidden">Clari CRM</span>
        </Link>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.path}
                    tooltip={item.label}
                  >
                    <Link to={item.path}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            {/* Settings items */}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarRail />
    </Sidebar>
  );
}
```

---

## Part 2: Update AppShell Layout

### Modify: `src/components/layout/AppShell.tsx`

Replace existing layout with SidebarProvider wrapper:

```tsx
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import Header from "./Header";

export default function AppShell({ children }: AppShellProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      <SidebarInset>
        <Header />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

Key changes:
- Remove manual `isMobile` checks and custom sidebar rendering
- Remove MobileNavigation import (shadcn handles mobile via Sheet)
- Use SidebarInset for main content area
- The shadcn Sidebar automatically handles mobile (shows as sheet) vs desktop (collapsible)

---

## Part 3: Update Header

### Modify: `src/components/layout/Header.tsx`

Add SidebarTrigger to header (works on both mobile and desktop):

```tsx
import { SidebarTrigger } from "@/components/ui/sidebar";

export default function Header() {
  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4">
      {/* SidebarTrigger - always visible, handles both mobile and desktop */}
      <SidebarTrigger />
      
      {/* Rest of header content */}
      <div className="ml-auto flex items-center gap-2 md:gap-4">
        {/* Search, notifications, user menu */}
      </div>
    </header>
  );
}
```

Remove:
- `onMenuToggle` prop (no longer needed)
- Manual hamburger menu button (SidebarTrigger replaces it)

---

## Part 4: Make Inbox Mobile Responsive

### Modify: `src/pages/Inbox.tsx`

| Change | Mobile (< md) | Desktop (>= md) |
|--------|---------------|-----------------|
| View mode | Force "full" mode | Split/full toggle |
| InboxSidebar | Hidden, show dropdown | Fixed 192px sidebar |
| Header controls | Stack vertically | Horizontal row |
| List width | Full width, constrained | Fixed 384px (split) or flex |

```tsx
import { useIsMobile } from "@/hooks/use-mobile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Inbox() {
  const isMobile = useIsMobile();
  
  // Auto-switch to full mode on mobile
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("inbox-view-mode") as ViewMode;
    return saved || "split";
  });
  
  // Force full mode on mobile
  const effectiveViewMode = isMobile ? "full" : viewMode;
  
  return (
    <div className="flex flex-col h-full">
      {/* Header - responsive stacking */}
      <div className="flex flex-col gap-3 p-4 border-b md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Mail className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Inbox</h1>
          <Tabs value={activeTab} onValueChange={...}>
            <TabsList>...</TabsList>
          </Tabs>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View mode toggle - hidden on mobile */}
          {!isMobile && hasConnectedAccount && (
            <div className="hidden md:flex items-center border rounded-md">...</div>
          )}
          <Button onClick={() => setComposeOpen(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Compose</span>
          </Button>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* InboxSidebar - desktop only */}
        {!isMobile && activeTab === "email" && (
          <InboxSidebar currentFolder={currentFolder} onFolderChange={...} />
        )}
        
        {/* Mobile folder dropdown */}
        {isMobile && activeTab === "email" && hasConnectedAccount && (
          <div className="px-4 py-2 border-b">
            <Select value={currentFolder} onValueChange={setCurrentFolder}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select folder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inbox">Inbox</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="drafts">Drafts</SelectItem>
                <SelectItem value="archive">Archive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        
        {/* Email list - constrained width */}
        <div className={cn(
          "border-r flex-shrink-0 overflow-hidden flex flex-col min-w-0",
          effectiveViewMode === "split" ? "w-96" : "flex-1 max-w-2xl"
        )}>
          ...
        </div>
      </div>
    </div>
  );
}
```

---

## Part 5: Fix Email/LinkedIn List Width Overflow

### Modify: `src/components/inbox/EmailList.tsx`

Add overflow constraints to prevent horizontal scroll:

```tsx
// Line 270 - Content container
<div className="flex-1 min-w-0 overflow-hidden pr-8">
  <div className="flex items-center justify-between gap-2">
    <span className={cn("text-sm truncate max-w-full", !email.is_read && "font-semibold")}>
      {email.direction === "inbound" ? email.from_name || email.from_email : ...}
    </span>
    ...
  </div>
  <p className={cn("text-sm truncate max-w-full", !email.is_read && "font-medium")}>
    {email.subject || "(No subject)"}
  </p>
  <p className="text-xs text-muted-foreground truncate max-w-full mt-0.5">
    {email.snippet}
  </p>
  {/* Badges - wrap instead of overflow */}
  <div className="flex items-center gap-2 mt-1.5 flex-wrap overflow-hidden">
    ...
  </div>
</div>
```

### Modify: `src/components/inbox/LinkedInMessageList.tsx`

Same overflow fix:

```tsx
// Line 73 - Content container
<div className="flex-1 min-w-0 overflow-hidden">
  ...
</div>
```

---

## Part 6: Make Other Pages Responsive

### Already Responsive
These pages already use proper responsive classes:
- `Customers.tsx`: Uses `flex-col sm:flex-row` for header
- `Dashboard.tsx`: Uses `md:grid-cols-2 lg:grid-cols-3` for grids
- `Sequences.tsx`: Uses `md:grid-cols-2 lg:grid-cols-3` for cards

### Needs Updates

#### `src/pages/Deals.tsx`
```tsx
// Header - add responsive stacking
<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
  ...
</div>

// Controls bar - wrap on mobile
<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
  {/* Pipeline selector - full width on mobile */}
  <Select value={...}>
    <SelectTrigger className="w-full sm:w-[200px]">...</SelectTrigger>
  </Select>
  
  {/* Search - grows to fill */}
  <div className="relative flex-1 min-w-0 sm:max-w-xs">...</div>
  
  {/* View mode toggles */}
  <div className="flex items-center gap-1 border rounded-md">...</div>
</div>
```

#### `src/pages/Analytics.tsx`
```tsx
// Responsive grid for metrics
<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
  ...
</div>

// Chart section - stack on mobile
<div className="grid gap-6 lg:grid-cols-2">
  <Card>Performance Chart</Card>
  <Card>Links Performance</Card>
</div>
```

---

## Part 7: Files to Delete

| File | Reason |
|------|--------|
| `src/components/layout/Sidebar.tsx` | Replaced by AppSidebar |
| `src/components/layout/MobileNavigation.tsx` | Replaced by shadcn Sidebar mobile sheet |

---

## Summary of File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/components/layout/AppSidebar.tsx` | Create | New collapsible sidebar |
| `src/components/layout/AppShell.tsx` | Modify | Use SidebarProvider |
| `src/components/layout/Header.tsx` | Modify | Add SidebarTrigger, remove hamburger |
| `src/pages/Inbox.tsx` | Modify | Mobile folder dropdown, constrain list width |
| `src/components/inbox/EmailList.tsx` | Modify | Add overflow-hidden |
| `src/components/inbox/LinkedInMessageList.tsx` | Modify | Add overflow-hidden |
| `src/pages/Deals.tsx` | Modify | Responsive header/controls |
| `src/pages/Analytics.tsx` | Modify | Responsive grids |
| `src/components/layout/Sidebar.tsx` | Delete | Replaced |
| `src/components/layout/MobileNavigation.tsx` | Delete | Replaced |

---

## Expected Behavior

### Desktop (>= 768px)
- Sidebar expanded by default (256px)
- Click toggle or press Ctrl+B to collapse to icon mode (48px)
- Tooltips appear on hover when collapsed
- State persisted in cookie

### Mobile (< 768px)
- Sidebar hidden by default
- SidebarTrigger shows hamburger icon
- Click opens sidebar as sheet overlay from left
- Sheet closes on outside click or navigation
- Inbox uses dropdown for folder selection instead of sidebar

### Tablet (768px - 1024px)
- Sidebar can be collapsed to save space
- Split view available in Inbox
- Grids adapt (2 columns instead of 3-4)

