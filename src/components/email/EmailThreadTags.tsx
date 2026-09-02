import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, Plus, Tag } from "lucide-react";

interface EmailThreadTagsProps {
  tags: string[];
  onUpdateTags: (tags: string[]) => void;
  disabled?: boolean;
  maxVisible?: number;
}

export function EmailThreadTags({ tags = [], onUpdateTags, disabled, maxVisible }: EmailThreadTagsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [showAll, setShowAll] = useState(false);

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      onUpdateTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onUpdateTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

    const visibleTags = (maxVisible && !showAll) ? tags.slice(0, maxVisible) : tags;
    const hiddenCount = maxVisible ? tags.length - (showAll ? tags.length : Math.min(maxVisible, tags.length)) : 0;

    return (
    <div className="flex items-center gap-1 flex-wrap">
      {visibleTags.map((tag) => (
        <Badge key={tag} variant="secondary" className="gap-1 text-xs px-1.5 py-0.5 h-5">
          <Tag className="h-2.5 w-2.5" />
          {tag}
          <button
            onClick={() => handleRemoveTag(tag)}
            disabled={disabled}
            className="ml-0.5 hover:text-destructive"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </Badge>
      ))}
      
      {hiddenCount > 0 && (
        <Badge 
          variant="outline" 
          className="text-xs px-1.5 py-0.5 h-5 cursor-pointer hover:bg-accent"
          onClick={() => setShowAll(true)}
        >
          +{hiddenCount}
        </Badge>
      )}
      
      {showAll && maxVisible && tags.length > maxVisible && (
        <button
          onClick={() => setShowAll(false)}
          className="text-xs text-muted-foreground hover:text-foreground ml-1"
        >
          Réduire
        </button>
      )}
      
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            disabled={disabled}
            className="h-5 text-xs px-1.5 py-0.5"
          >
            <Plus className="h-2.5 w-2.5 mr-0.5" />
            Tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Ajouter un tag</h4>
            <div className="flex gap-2">
              <Input
                placeholder="Nom du tag"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1"
              />
              <Button size="sm" onClick={handleAddTag} disabled={!newTag.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-2">Tags existants :</p>
                <div className="flex flex-wrap gap-1">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
