import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Phone, Building2, MessageSquare } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { EntityAvatar } from "@/components/ui/EntityAvatar";
import { queryPresets } from "@/lib/queryPresets";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  contactId: string;
  children: React.ReactNode;
}

export function AIContactHoverCard({ contactId, children }: Props) {
  const { data: contact } = useQuery({
    queryKey: ['contact-hover', contactId],
    queryFn: async () => {
      const { data } = await supabase
        .from('contacts')
        .select(`
          id,
          nom,
          prenom,
          email,
          telephone,
          fonction,
          niveau_contact,
          etablissement_id
        `)
        .eq('id', contactId)
        .maybeSingle();

      if (!data) return null;

      // Fetch establishment separately if needed
      let etablissement = null;
      if (data.etablissement_id) {
        const { data: etab } = await supabase
          .from('etablissements')
          .select('id, nom, ville')
          .eq('id', data.etablissement_id)
          .maybeSingle();
        etablissement = etab;
      }
      
      return { ...data, etablissement };
    },
    enabled: !!contactId,
    ...queryPresets.standard, // Normalized: 2min staleTime
  });

  // Get recent emails involving this contact
  const { data: recentEmails } = useQuery({
    queryKey: ['contact-emails-hover', contactId, contact?.email],
    queryFn: async () => {
      if (!contact?.email) return [];
      
      // Search in participants JSON field is complex, just skip for now
      return [];
    },
    enabled: !!contact?.email,
    ...queryPresets.standard, // Normalized: 2min staleTime
  });

  if (!contact) return <>{children}</>;

  const fullName = `${contact.prenom || ''} ${contact.nom}`.trim();

  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent className="w-80" side="right" align="start">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start gap-3">
            <EntityAvatar 
              name={fullName} 
              email={contact.email || undefined}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm leading-tight">
                {fullName}
              </h4>
              {contact.fonction && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {contact.fonction}
                </p>
              )}
              {contact.niveau_contact && (
                <Badge variant="secondary" className="mt-1 text-xs">
                  {contact.niveau_contact}
                </Badge>
              )}
            </div>
          </div>

          {/* Contact info */}
          <div className="space-y-1.5">
            {contact.email && (
              <a 
                href={`mailto:${contact.email}`}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{contact.email}</span>
              </a>
            )}
            {contact.telephone && (
              <a 
                href={`tel:${contact.telephone}`}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <Phone className="h-3 w-3 shrink-0" />
                <span>{contact.telephone}</span>
              </a>
            )}
          </div>

          {/* Établissement lié */}
          {contact.etablissement && (
            <div className="flex items-center gap-2 text-xs bg-muted/50 rounded-md px-2 py-1.5">
              <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Établissement:</span>
              <span className="font-medium truncate">{(contact.etablissement as any).nom}</span>
            </div>
          )}

          {/* Recent emails */}
          {recentEmails && recentEmails.length > 0 && (
            <div className="pt-2 border-t space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MessageSquare className="h-3 w-3" />
                <span>Derniers échanges</span>
              </div>
              {recentEmails.slice(0, 2).map((email: any) => (
                <div key={email.id} className="text-xs pl-4 text-muted-foreground line-clamp-1">
                  • {email.ai_generated_title || email.subject}
                </div>
              ))}
            </div>
          )}

          {/* Quick actions */}
          <div className="flex gap-2 pt-2 border-t">
            {contact.email && (
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 h-7 text-xs"
                onClick={() => window.location.href = `mailto:${contact.email}`}
              >
                <Mail className="h-3 w-3 mr-1" />
                Email
              </Button>
            )}
            {contact.telephone && (
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 h-7 text-xs"
                onClick={() => window.location.href = `tel:${contact.telephone}`}
              >
                <Phone className="h-3 w-3 mr-1" />
                Appeler
              </Button>
            )}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
