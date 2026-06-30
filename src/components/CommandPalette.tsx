import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  ServerCog,
  AlertTriangle,
  Target,
  FileText,
  Sparkles,
} from "lucide-react";

const pages = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/agents", label: "Agents", icon: ServerCog },
  { to: "/alerts", label: "Alerts", icon: AlertTriangle },
  { to: "/mitre", label: "MITRE ATT&CK", icon: Target },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/assistant", label: "AI Assistant", icon: Sparkles },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  function go(to: string) {
    setOpen(false);
    navigate({ to });
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to page, agent, or MITRE technique…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          {pages.map((p) => (
            <CommandItem key={p.to} value={`page ${p.label}`} onSelect={() => go(p.to)}>
              <p.icon className="mr-2 h-4 w-4" />
              {p.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="MITRE techniques">
          {[
            ["T1059", "Command and Scripting Interpreter"],
            ["T1055", "Process Injection"],
            ["T1003", "OS Credential Dumping"],
            ["T1071", "Application Layer Protocol"],
            ["T1547", "Boot or Logon Autostart Execution"],
          ].map(([id, name]) => (
            <CommandItem key={id} value={`mitre ${id} ${name}`} onSelect={() => go("/mitre")}>
              <Target className="mr-2 h-4 w-4" />
              <span className="font-mono text-xs mr-2">{id}</span>
              {name}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}