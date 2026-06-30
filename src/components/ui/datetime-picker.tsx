import * as React from "react";
import { format } from "date-fns";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface DateTimePickerProps {
  /** Value as datetime-local string ("yyyy-MM-ddTHH:mm") or empty. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  align?: "start" | "center" | "end";
}

function parse(value: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(+d) ? undefined : d;
}

function toLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick a date & time",
  className,
  align = "start",
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const date = parse(value);
  const time = date ? `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}` : "00:00";

  const handleDate = (next: Date | undefined) => {
    if (!next) return;
    const base = date ?? new Date();
    next.setHours(base.getHours(), base.getMinutes(), 0, 0);
    onChange(toLocal(next));
  };

  const handleTime = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const base = date ?? new Date();
    base.setHours(h || 0, m || 0, 0, 0);
    onChange(toLocal(base));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-10 w-full justify-start gap-2 bg-background/40 border-border/60 font-normal tabular-nums hover:border-primary/40 hover:bg-background/60",
            !date && "text-muted-foreground",
            className,
          )}
        >
          <CalendarRange className="h-4 w-4 text-muted-foreground/80" />
          {date ? format(date, "MMM d, yyyy · HH:mm") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-auto p-0 bg-popover border-border/70 shadow-xl"
      >
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleDate}
          initialFocus
          className="p-3 pointer-events-auto"
        />
        <div className="flex items-center gap-2 border-t border-border/60 p-3">
          <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">
            Time
          </label>
          <Input
            type="time"
            value={time}
            onChange={(e) => handleTime(e.target.value)}
            className="soc-datetime h-9 flex-1 bg-background/40"
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            Clear
          </Button>
          <Button type="button" size="sm" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}