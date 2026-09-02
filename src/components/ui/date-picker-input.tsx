import * as React from "react";
import { useState, useEffect } from "react";
import { format, parse, isValid } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface DatePickerWithInputProps {
  value: string | null | undefined;
  onChange: (dateStr: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function DatePickerWithInput({
  value,
  onChange,
  disabled = false,
  placeholder = "Sélectionner une date",
  className,
}: DatePickerWithInputProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [month, setMonth] = useState<Date>(new Date());

  const selectedDate = value ? new Date(value + "T00:00:00") : undefined;

  // Sync input text & calendar month when value changes or popover opens
  useEffect(() => {
    if (open && selectedDate && isValid(selectedDate)) {
      setInputValue(format(selectedDate, "dd/MM/yyyy"));
      setMonth(selectedDate);
    } else if (open && !value) {
      setInputValue("");
      setMonth(new Date());
    }
  }, [open, value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputValue(raw);

    // Auto-parse when full date typed
    if (raw.length === 10) {
      const parsed = parse(raw, "dd/MM/yyyy", new Date());
      if (isValid(parsed) && parsed.getFullYear() > 1900) {
        setMonth(parsed);
      }
    }
  };

  const handleInputBlur = () => {
    if (inputValue.length === 10) {
      const parsed = parse(inputValue, "dd/MM/yyyy", new Date());
      if (isValid(parsed) && parsed.getFullYear() > 1900) {
        onChange(formatDateLocal(parsed));
      }
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleInputBlur();
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      onChange(formatDateLocal(date));
      setInputValue(format(date, "dd/MM/yyyy"));
    } else {
      onChange(null);
      setInputValue("");
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal mt-1",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate && isValid(selectedDate)
            ? format(selectedDate, "PPP", { locale: fr })
            : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align="start"
        avoidCollisions={false}
        sideOffset={4}
      >
        <div className="p-3 pb-0">
          <Input
            type="text"
            placeholder="jj/mm/aaaa"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            className="h-8 text-sm"
            maxLength={10}
          />
        </div>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleCalendarSelect}
          month={month}
          onMonthChange={setMonth}
          locale={fr}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}
