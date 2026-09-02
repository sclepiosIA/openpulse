import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  avatarUrl?: string | null;
  email?: string;
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  xs: "h-6 w-6 text-xs",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-lg",
};

// Note: LinkedIn photo fallback via unavatar.io removed - service no longer supports LinkedIn

/**
 * Generate initials from name
 */
function getInitials(name: string): string {
  if (!name) return "?";
  
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/**
 * Generate a deterministic color based on string hash
 */
function getAvatarColor(str: string): string {
  const colors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-amber-500",
    "bg-yellow-500",
    "bg-lime-500",
    "bg-green-500",
    "bg-emerald-500",
    "bg-teal-500",
    "bg-cyan-500",
    "bg-sky-500",
    "bg-blue-500",
    "bg-indigo-500",
    "bg-violet-500",
    "bg-purple-500",
    "bg-fuchsia-500",
    "bg-pink-500",
    "bg-rose-500",
  ];
  
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

/**
 * UserAvatar component with smart fallback:
 * 1. Custom avatar_url if available
 * 2. LinkedIn photo via unavatar.io if linkedin_url is set
 * 3. Initials with generated color
 */
export function UserAvatar({
  avatarUrl,
  email,
  name,
  size = "md",
  className,
}: UserAvatarProps) {
  const initials = getInitials(name);
  const colorClass = getAvatarColor(name || email || "user");
  
  // Avatar priority: custom avatar_url > initials
  const imageUrl = avatarUrl || undefined;
  
  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {imageUrl && (
        <AvatarImage 
          src={imageUrl} 
          alt={name}
          className="object-cover"
        />
      )}
      <AvatarFallback className={cn(colorClass, "text-white font-medium")}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

export default UserAvatar;
