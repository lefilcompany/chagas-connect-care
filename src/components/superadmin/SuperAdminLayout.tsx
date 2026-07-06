import { Outlet } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { SuperAdminSidebar } from "./SuperAdminSidebar";
import { InstitutionScopeProvider, useInstitutionScope, ALL_INSTITUTIONS } from "./InstitutionScope";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

function TopBar() {
  const { selected, setSelected, institutions, loading } = useInstitutionScope();
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-6">
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-800 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Alterações afetam a infraestrutura
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Instituição:</span>
        <Select value={selected} onValueChange={setSelected} disabled={loading}>
          <SelectTrigger className="h-9 w-[260px]">
            <SelectValue placeholder="Selecionar instituição" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_INSTITUTIONS}>Todas as instituições</SelectItem>
            {institutions.map((i) => (
              <SelectItem key={i} value={i}>{i}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </header>
  );
}

export function SuperAdminLayout() {
  return (
    <InstitutionScopeProvider>
      <div className="flex h-dvh overflow-hidden bg-background">
        <SuperAdminSidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="min-h-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full w-full" type="hover">
              <div className="mx-auto w-full max-w-[1600px] px-6 py-6 md:px-8 md:py-8">
                <Outlet />
              </div>
            </ScrollArea>
          </main>
        </div>
      </div>
    </InstitutionScopeProvider>
  );
}