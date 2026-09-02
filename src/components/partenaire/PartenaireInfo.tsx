import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { linkify } from '@/lib/linkify'
import { Badge } from '@/components/ui/badge'
import { Partenaire } from '@/hooks/crm/usePartenaires'
import {
  MapPin,
  Phone,
  Mail,
  Globe,
  Calendar,
  TrendingUp,
  Target,
  User,
  Server,
} from 'lucide-react'

interface PartenaireInfoProps {
  partenaire: Partenaire
}

export function PartenaireInfo({ partenaire }: PartenaireInfoProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Informations générales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Informations générales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Type</p>
            <Badge className="mt-1">{partenaire.type_partenaire}</Badge>
            {partenaire.sous_type && (
              <Badge variant="outline" className="ml-2">
                {partenaire.sous_type}
              </Badge>
            )}
          </div>

          {partenaire.adresse && (
            <div>
              <p className="text-sm text-muted-foreground">Adresse</p>
              <p className="font-medium">{partenaire.adresse}</p>
              <p className="text-sm">
                {partenaire.code_postal} {partenaire.ville}
              </p>
              {partenaire.region && (
                <p className="text-sm text-muted-foreground">{partenaire.region}</p>
              )}
            </div>
          )}

          {partenaire.telephone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <a href={`tel:${partenaire.telephone}`} className="hover:underline">
                {partenaire.telephone}
              </a>
            </div>
          )}

          {partenaire.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a href={`mailto:${partenaire.email}`} className="hover:underline">
                {partenaire.email}
              </a>
            </div>
          )}

          {partenaire.site_web && (
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <a
                href={partenaire.site_web}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {partenaire.site_web}
              </a>
            </div>
          )}

          {partenaire.email_domains && partenaire.email_domains.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                <Server className="h-3 w-3" />
                Domaines email
              </p>
              <div className="flex flex-wrap gap-2">
                {partenaire.email_domains.map((domain) => (
                  <Badge key={domain} variant="secondary" className="text-xs">
                    {domain}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Relation partenariale */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Relation partenariale
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Statut</p>
            <Badge
              className="mt-1"
              variant={
                partenaire.statut_relation === 'actif'
                  ? 'default'
                  : partenaire.statut_relation === 'prospect'
                    ? 'secondary'
                    : partenaire.statut_relation === 'inactif'
                      ? 'outline'
                      : 'destructive'
              }
            >
              {partenaire.statut_relation}
            </Badge>
          </div>

          {partenaire.date_debut_partenariat && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                Début : {new Date(partenaire.date_debut_partenariat).toLocaleDateString('fr-FR')}
              </span>
            </div>
          )}

          {partenaire.date_fin_partenariat && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                Fin : {new Date(partenaire.date_fin_partenariat).toLocaleDateString('fr-FR')}
              </span>
            </div>
          )}

          {partenaire.responsable && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                Responsable : {partenaire.responsable.prenom} {partenaire.responsable.nom}
              </span>
            </div>
          )}

          {partenaire.valeur_partenariat && (
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                Valeur estimée :{' '}
                {partenaire.valeur_partenariat.toLocaleString('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                })}
              </span>
            </div>
          )}

          <div>
            <p className="text-sm text-muted-foreground mb-2">Score d'engagement</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${partenaire.engagement_score}%` }}
                />
              </div>
              <span className="text-sm font-medium">{partenaire.engagement_score}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {partenaire.notes && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap break-words">{linkify(partenaire.notes)}</p>
          </CardContent>
        </Card>
      )}

      {/* Tags */}
      {partenaire.tags && partenaire.tags.length > 0 && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {partenaire.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
