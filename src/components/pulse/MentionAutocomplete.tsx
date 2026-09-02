import { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  nom?: string;
  prenom?: string;
  avatar_url?: string;
}

interface MentionAutocompleteProps {
  users: User[];
  query: string;
  position: { top: number; left: number };
  onSelect: (user: User) => void;
  onClose: () => void;
  visible: boolean;
}

export function MentionAutocomplete({
  users,
  query,
  position,
  onSelect,
  onClose,
  visible,
}: MentionAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter users based on query
  const filteredUsers = users.filter((user) => {
    const fullName = `${user.prenom || ''} ${user.nom || ''}`.toLowerCase();
    return fullName.includes(query.toLowerCase());
  }).slice(0, 6);

  // Reset selection when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => 
            prev < filteredUsers.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          if (filteredUsers[selectedIndex]) {
            onSelect(filteredUsers[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, filteredUsers, selectedIndex, onSelect, onClose]);

  // Close when clicking outside
  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [visible, onClose]);

  const getInitials = (nom?: string, prenom?: string) => {
    return `${prenom?.[0] || ''}${nom?.[0] || ''}`.toUpperCase() || '?';
  };

  if (!visible || filteredUsers.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="absolute z-50 bg-popover border rounded-lg shadow-lg py-1 min-w-[200px] max-w-[300px]"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <div className="px-2 py-1 text-xs text-muted-foreground border-b mb-1">
        Mentionner quelqu'un
      </div>
      {filteredUsers.map((user, index) => (
        <button
          key={user.id}
          onClick={() => onSelect(user)}
          className={cn(
            "w-full flex items-center gap-2 px-2 py-1.5 text-sm transition-colors",
            index === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
          )}
        >
          <Avatar className="h-6 w-6">
            <AvatarImage src={user.avatar_url ?? undefined} />
            <AvatarFallback className="text-xs">
              {getInitials(user.nom, user.prenom)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate">
            {user.prenom} {user.nom}
          </span>
        </button>
      ))}
    </div>
  );
}
