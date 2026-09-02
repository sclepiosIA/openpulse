import { memo } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Mail, MessageSquare, Copy } from "lucide-react"
import { useToast } from "@/hooks/shared/use-toast"

interface TeamMemberCardProps {
  prenom: string
  nom: string
  email: string
  role: string | null
  roleColor?: string
  fonction?: string | null
}

function TeamMemberCardComponent({ prenom, nom, email, role, roleColor = "default", fonction }: TeamMemberCardProps) {
  const { toast } = useToast()
  const navigate = useNavigate()
  
  const getRoleLabel = (role: string | null) => {
    if (!role) return 'Non assigné';
    
    const roleLabels: Record<string, string> = {
      'admin': 'Administrateur',
      'commercial': 'Commercial',
      'chef_projet': 'Chef de projet',
      'csm': 'CSM',
      'manager': 'Manager'
    };
    
    return roleLabels[role] || role;
  };
  
  const getRoleColor = (role: string | null) => {
    if (!role) return 'outline';
    
    const roleColors: Record<string, string> = {
      'admin': 'destructive',
      'commercial': 'default',
      'chef_projet': 'secondary',
      'csm': 'default',
      'manager': 'secondary'
    };
    
    return roleColors[role] || 'outline';
  };
  
  const getInitials = () => {
    return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase()
  }

  const getAvatarColor = () => {
    const colors = [
      'bg-red-500',
      'bg-blue-500', 
      'bg-green-500',
      'bg-yellow-500',
      'bg-purple-500',
      'bg-pink-500'
    ]
    const index = (prenom.charCodeAt(0) + nom.charCodeAt(0)) % colors.length
    return colors[index]
  }

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(email)
    toast({ title: "Email copié", description: email })
  }

  const handleEmail = () => {
    const params = new URLSearchParams({ compose: 'true', to: email, toName: `${prenom} ${nom}`.trim() })
    navigate(`/emails?${params.toString()}`)
  }

  return (
    <Card className="hover:shadow-md transition-all">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Avatar className={`w-12 h-12 ${getAvatarColor()}`}>
            <AvatarFallback className="text-white font-semibold">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold truncate">{prenom} {nom}</h4>
              <Badge variant={getRoleColor(role) as any} className="text-xs">
                {getRoleLabel(role)}
              </Badge>
            </div>
            
            {fonction && (
              <div className="text-xs font-medium text-foreground mb-1">
                {fonction}
              </div>
            )}
            
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
              <Mail className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{email}</span>
            </div>
            
            <div className="flex gap-1">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleEmail}
                className="h-8 px-2"
                title="Envoyer un email"
              >
                <Mail className="w-3 h-3" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCopyEmail}
                className="h-8 px-2"
                title="Copier l'email"
              >
                <Copy className="w-3 h-3" />
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="h-8 px-2"
                title="Message"
              >
                <MessageSquare className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Memoized export to prevent unnecessary re-renders in lists
export const TeamMemberCard = memo(TeamMemberCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.prenom === nextProps.prenom &&
    prevProps.nom === nextProps.nom &&
    prevProps.email === nextProps.email &&
    prevProps.role === nextProps.role &&
    prevProps.fonction === nextProps.fonction
  );
});
