import { Card, CardContent } from "@/components/ui/card";
import { Mail } from "lucide-react";
import { useEmailsByPartenaire, type EmailThread } from "@/hooks/email/useEmailsByPartenaire";
import { useNavigate } from "react-router-dom";
import { sanitizeEmailSubject } from "@/lib/emailUtils";

interface PartenaireEmailsProps {
  partenaireId: string;
}

export function PartenaireEmails({ partenaireId }: PartenaireEmailsProps) {
  const { emails, isLoading } = useEmailsByPartenaire(partenaireId);
  const navigate = useNavigate();

  if (isLoading) {
    return <div>Chargement...</div>;
  }

  if (emails.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Aucun email</p>
          <p className="text-sm text-muted-foreground mt-2">
            Les emails associés à ce partenaire apparaîtront ici
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {emails.map((email: EmailThread) => (
        <Card 
          key={email.id} 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate(`/emails?thread=${email.id}`)}
        >
          <CardContent className="py-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-medium">{sanitizeEmailSubject(email.subject)}</h4>
                {email.ai_summary && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {sanitizeEmailSubject(email.ai_summary)}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>{new Date(email.last_message_date).toLocaleDateString('fr-FR')}</span>
                  <span>•</span>
                  <span>{email.message_count} message{email.message_count > 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
