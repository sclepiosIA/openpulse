import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
}

interface PasswordRule {
  label: string;
  test: (password: string) => boolean;
}

const passwordRules: PasswordRule[] = [
  { label: "Au moins 8 caractères", test: (p) => p.length >= 8 },
  { label: "Une lettre majuscule", test: (p) => /[A-Z]/.test(p) },
  { label: "Une lettre minuscule", test: (p) => /[a-z]/.test(p) },
  { label: "Un chiffre", test: (p) => /\d/.test(p) },
  { label: "Un caractère spécial", test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

export function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  const passedRules = passwordRules.filter((rule) => rule.test(password)).length;
  
  if (passedRules <= 1) return { score: 1, label: "Très faible", color: "bg-destructive" };
  if (passedRules === 2) return { score: 2, label: "Faible", color: "bg-orange-500" };
  if (passedRules === 3) return { score: 3, label: "Moyen", color: "bg-yellow-500" };
  if (passedRules === 4) return { score: 4, label: "Fort", color: "bg-green-500" };
  return { score: 5, label: "Très fort", color: "bg-primary" };
}

export function PasswordStrengthIndicator({ password, className }: PasswordStrengthIndicatorProps) {
  const strength = getPasswordStrength(password);
  
  if (!password) return null;
  
  return (
    <div className={cn("space-y-3 animate-fade-in", className)}>
      {/* Barre de progression */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Force du mot de passe</span>
          <span className={cn(
            "font-medium",
            strength.score <= 2 && "text-destructive",
            strength.score === 3 && "text-yellow-600 dark:text-yellow-400",
            strength.score >= 4 && "text-green-600 dark:text-green-400"
          )}>
            {strength.label}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn("h-full transition-all duration-300", strength.color)}
            style={{ width: `${(strength.score / 5) * 100}%` }}
          />
        </div>
      </div>
      
      {/* Liste des règles */}
      <ul className="grid grid-cols-1 gap-1 text-xs">
        {passwordRules.map((rule, index) => {
          const passed = rule.test(password);
          return (
            <li
              key={rule.label}
              className={cn(
                "flex items-center gap-2 transition-colors",
                passed ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
              )}
            >
              {passed ? (
                <Check className="h-3 w-3" />
              ) : (
                <X className="h-3 w-3" />
              )}
              <span>{rule.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
