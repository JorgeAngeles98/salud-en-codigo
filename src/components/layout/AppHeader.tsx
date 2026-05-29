"use client";

import { HeartPulse, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppHeaderProps {
  title?: string;
  userName?: string | null;
  centroNombre?: string | null;
  onSignOut?: () => void;
}

export function AppHeader({ title = "Salud en Código", userName, centroNombre, onSignOut }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="mx-auto max-w-lg flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center">
            <HeartPulse className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">{title}</p>
            {centroNombre && (
              <p className="text-[10px] text-gray-500">{centroNombre}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {userName && (
            <span className="text-xs text-gray-500 hidden sm:block">{userName}</span>
          )}
          {onSignOut && (
            <Button variant="ghost" size="icon" onClick={onSignOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
