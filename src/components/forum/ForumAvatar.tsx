import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useMemo } from "react";

interface ForumAvatarProps {
  nom?: string;
  prenom?: string;
  className?: string;
}

export function ForumAvatar({ nom, prenom, className }: ForumAvatarProps) {
  const initials = useMemo(() => {
    return `${prenom?.charAt(0) || ""}${nom?.charAt(0) || ""}`.toUpperCase() || "?";
  }, [nom, prenom]);

  const backgroundColor = useMemo(() => {
    const fullName = `${prenom || ""} ${nom || ""}`.toLowerCase();
    let hash = 0;
    for (let i = 0; i < fullName.length; i++) {
      hash = fullName.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const colors = [
      "hsl(var(--primary))",
      "hsl(220, 70%, 55%)",
      "hsl(280, 65%, 55%)",
      "hsl(340, 75%, 55%)",
      "hsl(160, 65%, 45%)",
      "hsl(30, 80%, 55%)",
      "hsl(190, 70%, 50%)",
      "hsl(260, 60%, 55%)",
    ];
    
    return colors[Math.abs(hash) % colors.length];
  }, [nom, prenom]);

  return (
    <Avatar className={className}>
      <AvatarFallback 
        style={{ backgroundColor }}
        className="text-white font-semibold"
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
