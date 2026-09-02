import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Check, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EditableCellProps {
  value: string | number | null;
  onSave: (value: string | number) => void;
  type?: "text" | "number" | "currency" | "select";
  options?: { value: string; label: string }[];
  disabled?: boolean;
  className?: string;
  formatDisplay?: (value: string | number | null) => string;
  placeholder?: string;
}

export function EditableCell({
  value,
  onSave,
  type = "text",
  options = [],
  disabled = false,
  className,
  formatDisplay,
  placeholder = "-"
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>(String(value ?? ""));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(String(value ?? ""));
  }, [value]);

  const handleSave = () => {
    const finalValue = type === "number" || type === "currency" 
      ? parseFloat(editValue) || 0 
      : editValue;
    onSave(finalValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(String(value ?? ""));
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  const displayValue = formatDisplay 
    ? formatDisplay(value) 
    : value ?? placeholder;

  if (disabled) {
    return (
      <div className={cn("flex items-center gap-1 rounded px-1 -mx-1", className)}>
        <span>{displayValue}</span>
      </div>
    );
  }

  if (isEditing) {
    if (type === "select") {
      return (
        <div className="flex items-center gap-1">
          <Select value={editValue} onValueChange={(v) => { setEditValue(v); }}>
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSave} aria-label="Valider">
            <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCancel} aria-label="Fermer">
            <X className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          type={type === "currency" ? "number" : type}
          step={type === "currency" ? "0.01" : undefined}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="h-8 w-[120px]"
        />
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "group/cell flex items-center gap-1 cursor-pointer rounded px-1 -mx-1 hover:bg-muted/50 transition-colors",
        className
      )}
      onClick={() => setIsEditing(true)}
      title="Cliquer pour modifier"
    >
      <span>{displayValue}</span>
      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover/cell:opacity-100 transition-opacity" />
    </div>
  );
}
