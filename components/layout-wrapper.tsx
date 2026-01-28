"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu } from "lucide-react";
import { useSession } from "next-auth/react";

import { BottomNav } from "@/components/bottom-nav";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

type LayoutWrapperProps = {
  children: React.ReactNode;
};

export function LayoutWrapper({ children }: LayoutWrapperProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data } = useSession();
  const label =
    data?.user?.name?.trim() ||
    data?.user?.email?.split("@")[0]?.trim() ||
    "";
  const initial = label ? label[0]?.toUpperCase() : "?";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <div className="hidden w-64 shrink-0 md:block">
          <Sidebar />
        </div>
        <div className="flex min-h-screen flex-1 flex-col">
          <header className="flex justify-center border-b bg-background/80 px-4 py-3 backdrop-blur">
            <div className="flex flex-row items-center justify-between w-full gap-2 lg:justify-end">
              
              <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Open menu" className="md:hidden">
                    <Menu className="size-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[18rem] max-w-[18rem] p-0">
                  <Sidebar onNavigate={() => setMobileOpen(false)} />
                </DialogContent>
              </Dialog>
              <Link
                href="/"
                className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground lg:hidden"
              >
                BettorOS
              </Link>
            
            <Button
              asChild
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full text-xs font-semibold"
            >
              <Link href="/account" aria-label="User area">
                {initial}
              </Link>
            </Button>
            </div>
          </header>
          <main className="flex-1 px-4 py-6 pb-24 md:px-8 md:pb-6">
            {children}
          </main>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
