"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

type LayoutWrapperProps = {
  children: React.ReactNode;
};

export function LayoutWrapper({ children }: LayoutWrapperProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <div className="hidden w-64 shrink-0 md:block">
          <Sidebar />
        </div>
        <div className="flex min-h-screen flex-1 flex-col">
          <header className="flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur md:hidden">
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              BettorOS
            </span>
            <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu className="size-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[18rem] max-w-[18rem] p-0">
                <Sidebar onNavigate={() => setMobileOpen(false)} />
              </DialogContent>
            </Dialog>
          </header>
          <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
