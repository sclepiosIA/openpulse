import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useEmailDomainMappings,
  useUpdateDomainMapping,
  useRemoveDomainMapping,
} from "@/hooks/email/useEmailDomainMappings";
import { useEmailSuggestionsPending } from "@/hooks/email/useEmailSuggestionsPending";
import { EmailClassificationDashboard } from "@/components/email/EmailClassificationDashboard";
import { EmailSuggestionsPendingWidget } from "@/components/email/EmailSuggestionsPendingWidget";
import {
  Mail,
  Search,
  AlertTriangle,
  CheckCircle,
  BarChart,
  Trash2,
  Shield,
  Building2,
  Users,
  Briefcase,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PageDataState } from "@/components/common/PageDataState";

export default function GestionEmailDomains() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterConfidence, setFilterConfidence] = useState<string>("all");
  const [filterEntityType, setFilterEntityType] = useState<string>("all");
  const [includeExcluded, setIncludeExcluded] = useState(false);

  const { data: mappings, isLoading, isError, refetch } = useEmailDomainMappings({ includeExcluded });
  const { data: pendingSuggestions } = useEmailSuggestionsPending();
  const updateMapping = useUpdateDomainMapping();
  const removeMapping = useRemoveDomainMapping();

  const filteredMappings = mappings?.filter((mapping) => {
    if (searchQuery && !mapping.domain.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterConfidence !== "all" && mapping.confidence_level !== filterConfidence) {
      return false;
    }
    if (filterEntityType !== "all") {
      if (filterEntityType === "etablissement" && !mapping.etablissement_id) return false;
      if (filterEntityType === "groupe" && !mapping.groupe_id) return false;
      if (filterEntityType === "partenaire" && !mapping.partenaire_id) return false;
    }
    return true;
  });

  // Regrouper par type d'entité
  const groupedByEntity = {
    etablissements: {} as Record<string, typeof filteredMappings>,
    groupes: {} as Record<string, typeof filteredMappings>,
    partenaires: {} as Record<string, typeof filteredMappings>,
  };

  filteredMappings?.forEach((mapping) => {
    if (mapping.etablissement_id && mapping.etablissement) {
      const key = mapping.etablissement.nom;
      if (!groupedByEntity.etablissements[key]) {
        groupedByEntity.etablissements[key] = [];
      }
      groupedByEntity.etablissements[key].push(mapping);
    } else if (mapping.groupe_id && mapping.groupe) {
      const key = mapping.groupe.nom;
      if (!groupedByEntity.groupes[key]) {
        groupedByEntity.groupes[key] = [];
      }
      groupedByEntity.groupes[key].push(mapping);
    } else if (mapping.partenaire_id && mapping.partenaire) {
      const key = mapping.partenaire.nom;
      if (!groupedByEntity.partenaires[key]) {
        groupedByEntity.partenaires[key] = [];
      }
      groupedByEntity.partenaires[key].push(mapping);
    }
  });

  const handleToggleVerified = (mappingId: string, currentVerified: boolean) => {
    updateMapping.mutate({
      mappingId,
      verified: !currentVerified,
    });
  };

  const handleChangeConfidence = (mappingId: string, confidenceLevel: 'high' | 'medium' | 'low') => {
    updateMapping.mutate({
      mappingId,
      confidenceLevel,
    });
  };

  const handleRemove = (mappingId: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer/exclure ce domaine ?")) {
      removeMapping.mutate(mappingId);
    }
  };

  if (isLoading || isError) {
    return (
      <div className="w-full max-w-full overflow-x-hidden px-3 sm:px-4 lg:px-6 py-6">
        <PageDataState isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
          <></>
        </PageDataState>
      </div>
    );
  }

  const totalEtablissements = Object.keys(groupedByEntity.etablissements).length;
  const totalGroupes = Object.keys(groupedByEntity.groupes).length;
  const totalPartenaires = Object.keys(groupedByEntity.partenaires).length;

  return (
    <div className="w-full max-w-full overflow-x-hidden px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6 space-y-4 sm:space-y-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Gestion des domaines email</h1>
            <p className="text-muted-foreground mt-2">
              Gérez les associations entre domaines email et entités
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => navigate('/email-classification-analytics')}
            >
              <BarChart className="mr-2 h-4 w-4" />
              Dashboard complet
            </Button>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Mail, value: mappings?.length || 0, label: "Domaines associés", color: "text-primary" },
            { icon: AlertTriangle, value: pendingSuggestions?.length || 0, label: "Suggestions en attente", color: "text-amber-500" },
            { icon: CheckCircle, value: mappings?.filter((m) => m.verified).length || 0, label: "Domaines vérifiés", color: "text-green-500" },
            { icon: Building2, value: totalEtablissements + totalGroupes + totalPartenaires, label: "Entités", color: "text-blue-500" }
          ].map((stat, index) => (
            <Card key={`stat-${stat.label}`} className="p-4 hover-scale animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
              <div className="flex items-center gap-3">
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Tabs */}
      <Tabs defaultValue="suggestions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="suggestions" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">Suggestions IA</span>
            <span className="sm:hidden">Suggestions</span>
            {pendingSuggestions && pendingSuggestions.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {pendingSuggestions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="mappings" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Domaines configurés</span>
            <span className="sm:hidden">Domaines</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>
        
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-2">
          <span className="flex items-center gap-1">
            <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center font-medium">1</span>
            Suggestions IA
          </span>
          <span>→</span>
          <span className="flex items-center gap-1">
            <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center font-medium">2</span>
            Validation
          </span>
          <span>→</span>
          <span className="flex items-center gap-1">
            <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center font-medium">3</span>
            Configuration active
          </span>
        </div>

        <TabsContent value="suggestions" className="space-y-6">
          <Card className="p-4 bg-muted/50">
            <p className="text-sm text-muted-foreground">
              <strong>Étape 1 :</strong> Vérifiez et validez les associations suggérées par l'IA. 
              Une fois acceptées, elles deviennent des règles de classification automatique.
            </p>
          </Card>
          <EmailSuggestionsPendingWidget />
        </TabsContent>

        <TabsContent value="mappings" className="space-y-6">
          <Card className="p-4 bg-muted/50">
            <p className="text-sm text-muted-foreground">
              <strong>Étape 2 :</strong> Gérez les règles de classification validées pour la classification automatique des futurs emails.
            </p>
          </Card>
            {/* Filtres */}
            <Card className="p-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Rechercher un domaine..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Select value={filterConfidence} onValueChange={setFilterConfidence}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Niveau de confiance" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les niveaux</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterEntityType} onValueChange={setFilterEntityType}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Type d'entité" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les entités</SelectItem>
                      <SelectItem value="etablissement">Établissements</SelectItem>
                      <SelectItem value="groupe">Groupes</SelectItem>
                      <SelectItem value="partenaire">Partenaires</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="include-excluded"
                    checked={includeExcluded}
                    onCheckedChange={setIncludeExcluded}
                  />
                  <Label htmlFor="include-excluded" className="text-sm">
                    Inclure les domaines exclus
                  </Label>
                </div>
              </div>
            </Card>

            {/* Liste groupée par entité */}
            <div className="space-y-6">
              {/* Établissements */}
              {Object.keys(groupedByEntity.etablissements).length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold">Établissements</h2>
                    <Badge variant="secondary">{totalEtablissements}</Badge>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(groupedByEntity.etablissements).map(([name, domains]) => (
                      <Card key={name} className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="font-medium">{name}</h3>
                            <Badge variant="outline">{domains?.length || 0} domaine(s)</Badge>
                          </div>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            {domains?.map((mapping) => (
                              <div
                                key={mapping.id}
                                className={`p-3 rounded-lg border ${
                                  mapping.is_excluded ? 'bg-muted/50 border-destructive/50' : 'bg-card border-border'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0 space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono text-sm font-medium truncate">
                                        {mapping.domain}
                                      </span>
                                      {mapping.is_excluded && (
                                        <Badge variant="destructive" className="text-xs">
                                          Exclu
                                        </Badge>
                                      )}
                                      {mapping.prevent_auto && (
                                        <Badge variant="outline" className="text-xs">
                                          <Shield className="h-3 w-3 mr-1" />
                                          Verrouillé
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Select
                                        value={mapping.confidence_level}
                                        onValueChange={(value: 'high' | 'medium' | 'low') =>
                                          handleChangeConfidence(mapping.id, value)
                                        }
                                        disabled={mapping.is_excluded}
                                      >
                                        <SelectTrigger className="h-7 w-28 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="high">High</SelectItem>
                                          <SelectItem value="medium">Medium</SelectItem>
                                          <SelectItem value="low">Low</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <Button
                                        variant={mapping.verified ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => handleToggleVerified(mapping.id, mapping.verified)}
                                        disabled={mapping.is_excluded}
                                        className="h-7"
                                      >
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        {mapping.verified ? "Vérifié" : "Non vérifié"}
                                      </Button>
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemove(mapping.id)}
                                    className="h-7 px-2"
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Groupes */}
              {Object.keys(groupedByEntity.groupes).length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-500" />
                    <h2 className="text-xl font-semibold">Groupes</h2>
                    <Badge variant="secondary">{totalGroupes}</Badge>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(groupedByEntity.groupes).map(([name, domains]) => (
                      <Card key={name} className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="font-medium">{name}</h3>
                            <Badge variant="outline">{domains?.length || 0} domaine(s)</Badge>
                          </div>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            {domains?.map((mapping) => (
                              <div
                                key={mapping.id}
                                className={`p-3 rounded-lg border ${
                                  mapping.is_excluded ? 'bg-muted/50 border-destructive/50' : 'bg-card border-border'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0 space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono text-sm font-medium truncate">
                                        {mapping.domain}
                                      </span>
                                      {mapping.is_excluded && (
                                        <Badge variant="destructive" className="text-xs">
                                          Exclu
                                        </Badge>
                                      )}
                                      {mapping.prevent_auto && (
                                        <Badge variant="outline" className="text-xs">
                                          <Shield className="h-3 w-3 mr-1" />
                                          Verrouillé
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Select
                                        value={mapping.confidence_level}
                                        onValueChange={(value: 'high' | 'medium' | 'low') =>
                                          handleChangeConfidence(mapping.id, value)
                                        }
                                        disabled={mapping.is_excluded}
                                      >
                                        <SelectTrigger className="h-7 w-28 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="high">High</SelectItem>
                                          <SelectItem value="medium">Medium</SelectItem>
                                          <SelectItem value="low">Low</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <Button
                                        variant={mapping.verified ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => handleToggleVerified(mapping.id, mapping.verified)}
                                        disabled={mapping.is_excluded}
                                        className="h-7"
                                      >
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        {mapping.verified ? "Vérifié" : "Non vérifié"}
                                      </Button>
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemove(mapping.id)}
                                    className="h-7 px-2"
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Partenaires */}
              {Object.keys(groupedByEntity.partenaires).length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-green-500" />
                    <h2 className="text-xl font-semibold">Partenaires</h2>
                    <Badge variant="secondary">{totalPartenaires}</Badge>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(groupedByEntity.partenaires).map(([name, domains]) => (
                      <Card key={name} className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="font-medium">{name}</h3>
                            <Badge variant="outline">{domains?.length || 0} domaine(s)</Badge>
                          </div>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            {domains?.map((mapping) => (
                              <div
                                key={mapping.id}
                                className={`p-3 rounded-lg border ${
                                  mapping.is_excluded ? 'bg-muted/50 border-destructive/50' : 'bg-card border-border'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0 space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono text-sm font-medium truncate">
                                        {mapping.domain}
                                      </span>
                                      {mapping.is_excluded && (
                                        <Badge variant="destructive" className="text-xs">
                                          Exclu
                                        </Badge>
                                      )}
                                      {mapping.prevent_auto && (
                                        <Badge variant="outline" className="text-xs">
                                          <Shield className="h-3 w-3 mr-1" />
                                          Verrouillé
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Select
                                        value={mapping.confidence_level}
                                        onValueChange={(value: 'high' | 'medium' | 'low') =>
                                          handleChangeConfidence(mapping.id, value)
                                        }
                                        disabled={mapping.is_excluded}
                                      >
                                        <SelectTrigger className="h-7 w-28 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="high">High</SelectItem>
                                          <SelectItem value="medium">Medium</SelectItem>
                                          <SelectItem value="low">Low</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <Button
                                        variant={mapping.verified ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => handleToggleVerified(mapping.id, mapping.verified)}
                                        disabled={mapping.is_excluded}
                                        className="h-7"
                                      >
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        {mapping.verified ? "Vérifié" : "Non vérifié"}
                                      </Button>
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemove(mapping.id)}
                                    className="h-7 px-2"
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {totalEtablissements === 0 && totalGroupes === 0 && totalPartenaires === 0 && (
                <Card className="p-12">
                  <div className="text-center space-y-3">
                    <Mail className="h-12 w-12 mx-auto text-muted-foreground" />
                    <h3 className="text-lg font-semibold">Aucun domaine trouvé</h3>
                    <p className="text-muted-foreground">
                      Commencez par associer des domaines email aux entités
                    </p>
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="animate-fade-in">
            <EmailClassificationDashboard />
          </TabsContent>

          <TabsContent value="suggestions" className="animate-fade-in">
            <EmailSuggestionsPendingWidget />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}