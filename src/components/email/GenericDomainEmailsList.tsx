import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmailSpecificMappingDialog } from "./EmailSpecificMappingDialog";
import { Loader2, AtSign, ChevronRight, Ban } from "lucide-react";
import { isGenericDomain } from "@/lib/emailUtils";
import { sanitizeEmailSubject } from "@/lib/emailUtils";
import { useMarkEmailAsUnaffiliated } from "@/hooks/email/useEmailSpecificMappings";
import { supabase } from "@/integrations/supabase/client";

interface GenericEmailGroup {
  email: string;
  threads: Array<{
    id: string;
    subject: string;
    last_message_date: string;
  }>;
}

function useGenericDomainUnclassifiedEmails() {
  return useQuery({
    queryKey: ['generic-domain-unclassified-emails'],
    queryFn: async () => {
      // 1. Récupérer les threads non classifiés
      const { data: threads } = await supabase
        .from('email_threads')
        .select(`
          id,
          subject,
          last_message_date,
          email_messages!inner(from_address, to_addresses)
        `)
        .is('etablissement_id', null)
        .is('groupe_id', null)
        .is('partenaire_id', null)
        .order('last_message_date', { ascending: false });

      // 2. Récupérer les affiliations spécifiques existantes
      const { data: specificMappings } = await supabase
        .from('email_specific_mappings')
        .select('email_address');

      const affiliatedEmails = new Set(
        specificMappings?.map(m => m.email_address.toLowerCase()) || []
      );

      // 3. Filtrer pour ne garder que les emails de domaines génériques non affiliés
      const genericEmails: any[] = [];
      
      threads?.forEach(thread => {
        const messages = thread.email_messages;
        if (!messages || messages.length === 0) return;

        const fromAddress = messages[0].from_address?.toLowerCase();
        if (!fromAddress) return;

        // Vérifier si c'est un domaine générique
        const domain = fromAddress.split('@')[1];
        if (!domain || !isGenericDomain(domain)) return;

        // Vérifier si cette adresse spécifique n'est pas déjà affiliée
        if (affiliatedEmails.has(fromAddress)) return;

        genericEmails.push(thread);
      });

      // 4. Regrouper par adresse email
      const emailGroups = new Map<string, GenericEmailGroup>();
      
      genericEmails.forEach(thread => {
        const fromAddress = thread.email_messages[0].from_address;
        if (!emailGroups.has(fromAddress)) {
          emailGroups.set(fromAddress, {
            email: fromAddress,
            threads: [],
          });
        }
        emailGroups.get(fromAddress)!.threads.push({
          id: thread.id,
          subject: thread.subject || 'Sans objet',
          last_message_date: thread.last_message_date,
        });
      });

      return Array.from(emailGroups.values()).sort((a, b) => b.threads.length - a.threads.length);
    },
    staleTime: 30000,
  });
}

export function GenericDomainEmailsList() {
  const { data: emailGroups, isLoading } = useGenericDomainUnclassifiedEmails();
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const markAsUnaffiliated = useMarkEmailAsUnaffiliated();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!emailGroups || emailGroups.length === 0) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AtSign className="h-5 w-5" />
            Emails personnels à affilier
          </CardTitle>
          <CardDescription>
            Ces emails proviennent de domaines publics (Gmail, Hotmail, etc.) et doivent être affiliés individuellement.
            {emailGroups.length > 0 && (
              <span className="block mt-1 font-medium text-foreground">
                {emailGroups.length} adresse{emailGroups.length > 1 ? 's' : ''} • {emailGroups.reduce((sum, g) => sum + g.threads.length, 0)} conversation{emailGroups.reduce((sum, g) => sum + g.threads.length, 0) > 1 ? 's' : ''}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-3 pr-4">
              {emailGroups.map(group => (
                <div key={group.email} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm font-medium truncate">{group.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.threads.length} conversation{group.threads.length > 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm"
                        variant="outline"
                        onClick={() => markAsUnaffiliated.mutate(group.email)}
                        disabled={markAsUnaffiliated.isPending}
                      >
                        <Ban className="mr-2 h-3 w-3" />
                        Non affilié
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => setSelectedEmail(group.email)}
                      >
                        <AtSign className="mr-2 h-3 w-3" />
                        Affilier
                      </Button>
                    </div>
                  </div>
                  
                  {/* Afficher les 2 premiers sujets */}
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">Exemples de sujets :</p>
                    {group.threads.slice(0, 2).map(thread => (
                      <div key={thread.id} className="flex items-start gap-1.5">
                        <ChevronRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <p className="truncate">{sanitizeEmailSubject(thread.subject)}</p>
                      </div>
                    ))}
                    {group.threads.length > 2 && (
                      <p className="text-xs italic">+ {group.threads.length - 2} autre{group.threads.length - 2 > 1 ? 's' : ''}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <EmailSpecificMappingDialog
        open={selectedEmail !== null}
        onOpenChange={(open) => !open && setSelectedEmail(null)}
        defaultEmail={selectedEmail || undefined}
      />
    </>
  );
}
