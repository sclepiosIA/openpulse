import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useActiveEmailTemplates, type ActiveEmailTemplate } from "@/hooks/email/useActiveEmailTemplates";

interface MobileTemplateSelectorProps {
  onSelect: (template: ActiveEmailTemplate) => void;
  onClose: () => void;
}

/**
 * Sélecteur de templates d'emails pour mobile (drawer)
 */
export function MobileTemplateSelector({
  onSelect,
  onClose,
}: MobileTemplateSelectorProps) {
  const { data: templates = [], isLoading: loading } = useActiveEmailTemplates();
  const [search, setSearch] = useState("");

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.subject.toLowerCase().includes(search.toLowerCase()) ||
    (t.category && t.category.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSelect = (template: ActiveEmailTemplate) => {
    onSelect(template);
    onClose();
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Recherche sticky */}
      <div className="p-4 border-b bg-background sticky top-0 z-10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un modèle..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Liste des templates */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredTemplates.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {search ? "Aucun modèle trouvé" : "Aucun modèle disponible"}
          </p>
        ) : (
          filteredTemplates.map((template) => (
            <Card
              key={template.id}
              className="p-4 cursor-pointer hover:bg-accent transition-colors active:scale-98"
              onClick={() => handleSelect(template)}
            >
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-medium text-sm">{template.name}</h4>
                  {template.category && (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {template.category}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  Objet: {template.subject}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
                  {template.content}
                </p>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
