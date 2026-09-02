import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Award, GraduationCap, Target, TrendingUp, AlertTriangle, Users } from "lucide-react";
import { useCompetencesKPIs } from "@/hooks/competences/useCompetencesKPIs";
import { useReferentielCompetences } from "@/hooks/competences/useReferentielCompetences";
import { useEmployeeCertifications } from "@/hooks/hr/useEmployeeCertifications";
import { usePlansDeveloppement } from "@/hooks/rd/usePlansDeveloppement";
import { CATEGORIE_LABELS, PLAN_STATUT_LABELS, PLAN_STATUT_COLORS, type EmployeeCertification } from "@/types/competences";
import { format, differenceInDays } from "date-fns";

import { useIsMobile } from "@/hooks/ui/use-mobile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageDataState } from "@/components/common/PageDataState";
import { toast } from "sonner";
import AddEmployeeCertificationDialog from "@/components/competences/AddEmployeeCertificationDialog";

export default function Competences() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showAddCertif, setShowAddCertif] = useState(false);
  const isMobile = useIsMobile();
  
  const { data: kpis, isLoading: kpisLoading, isError: kpisError, refetch: refetchKpis } = useCompetencesKPIs();
  const { competences, competencesByCategory, isLoading: compLoading, error: compError } = useReferentielCompetences();
  const { employeeCertifications, expiringCertifications, isLoading: certLoading, error: certError } = useEmployeeCertifications();
  const { plans, isLoading: plansLoading, error: plansError } = usePlansDeveloppement();
  const hasError = kpisError || !!compError || !!certError || !!plansError;

  const kpiCards = [
    { label: "Compétences", value: kpis?.totalCompetences || 0, icon: Award, color: "text-blue-600" },
    { label: "Employés formés", value: kpis?.totalEmployeesWithCompetences || 0, icon: Users, color: "text-purple-600" },
    { label: "Moy. compétences/employé", value: kpis?.averageCompetencesPerEmployee || 0, icon: TrendingUp, color: "text-green-600" },
    { label: "Certif. expirent 30j", value: kpis?.certificationExpiringIn30Days || 0, icon: AlertTriangle, color: "text-red-600" },
    { label: "Plans en cours", value: kpis?.plansEnCours || 0, icon: Target, color: "text-indigo-600" },
  ];

  const tabs = [
    { value: "dashboard", label: "Dashboard" },
    { value: "referentiel", label: `Référentiel (${competences.length})` },
    { value: "certifications", label: `Certifications (${employeeCertifications.length})` },
    { value: "plans", label: `Plans (${plans.length})` },
  ];

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Compétences & Certifications</h1>
          <p className="text-muted-foreground">Gérez les compétences et certifications de l'équipe</p>
        </div>
        <Button disabled title="Création disponible prochainement">
          <Plus className="h-4 w-4 mr-2" />
          Ajouter
        </Button>
      </div>

      <PageDataState
        isLoading={kpisLoading && compLoading && certLoading && plansLoading && !kpis}
        isError={hasError}
        onRetry={() => { refetchKpis(); }}
      >

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 md:gap-3">
                <kpi.icon className={`h-6 w-6 md:h-8 md:w-8 ${kpi.color}`} />
                <div>
                  <p className="text-xl md:text-2xl font-bold">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {isMobile ? (
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-full mb-4">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tabs.map(tab => (
                <SelectItem key={tab.value} value={tab.value}>{tab.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <TabsList className="mb-4">
            {tabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
            ))}
          </TabsList>
        )}

        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Compétences par catégorie */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Compétences par catégorie
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {compLoading ? (
                  <p className="text-muted-foreground">Chargement...</p>
                ) : Object.entries(competencesByCategory).length === 0 ? (
                  <p className="text-muted-foreground">Aucune compétence dans le référentiel</p>
                ) : (
                  Object.entries(competencesByCategory).map(([cat, comps]) => (
                    <div key={cat} className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="font-medium">{CATEGORIE_LABELS[cat as keyof typeof CATEGORIE_LABELS] || cat}</span>
                      <Badge variant="secondary">{comps.length}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Certifications à renouveler */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Certifications à renouveler
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
              {certLoading ? (
                  <p className="text-muted-foreground">Chargement...</p>
                ) : expiringCertifications.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Aucune certification à renouveler prochainement</p>
                ) : (
                  expiringCertifications.slice(0, 5).map((cert: EmployeeCertification) => {
                    const daysLeft = cert.date_expiration ? differenceInDays(new Date(cert.date_expiration), new Date()) : null;
                    return (
                      <div key={cert.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{cert.certification?.nom || 'Certification'}</p>
                          <p className="text-xs text-muted-foreground">{cert.profile?.prenom} {cert.profile?.nom}</p>
                        </div>
                        <Badge variant={daysLeft && daysLeft <= 30 ? "destructive" : "secondary"}>
                          {daysLeft !== null ? `${daysLeft}j` : 'N/A'}
                        </Badge>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* Plans de développement */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Plans de développement en cours
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {plansLoading ? (
                  <p className="text-muted-foreground">Chargement...</p>
                ) : plans.filter(p => p.statut === 'en_cours').length === 0 ? (
                  <p className="text-muted-foreground">Aucun plan de développement en cours</p>
                ) : (
                  plans.filter(p => p.statut === 'en_cours').slice(0, 5).map((plan) => (
                    <div key={plan.id} className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{plan.titre}</p>
                          <p className="text-xs text-muted-foreground">
                            {plan.profile?.prenom} {plan.profile?.nom}
                          </p>
                        </div>
                        <Badge className={PLAN_STATUT_COLORS[plan.statut]}>
                          {PLAN_STATUT_LABELS[plan.statut]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={plan.progression || 0} className="flex-1 h-2" />
                        <span className="text-sm font-medium">{plan.progression || 0}%</span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="referentiel">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Référentiel des Compétences</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => toast.info("Création de compétences", { description: "Module en cours de finalisation — disponible dans la prochaine release." })}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle compétence
              </Button>
            </CardHeader>
            <CardContent>
              {compLoading ? (
                <p>Chargement...</p>
              ) : competences.length === 0 ? (
                <div className="text-center py-12">
                  <Award className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">Aucune compétence</p>
                  <p className="text-muted-foreground mb-4">Créez votre référentiel de compétences</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(competencesByCategory).map(([cat, comps]) => (
                    <div key={cat}>
                      <h3 className="font-semibold text-sm text-muted-foreground mb-2">
                        {CATEGORIE_LABELS[cat as keyof typeof CATEGORIE_LABELS] || cat}
                      </h3>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {comps.map(comp => (
                          <div key={comp.id} className="p-3 border rounded-lg hover:bg-muted/50">
                            <p className="font-medium">{comp.nom}</p>
                            {comp.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">{comp.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="certifications">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Certifications des Employés</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddCertif(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter certification
              </Button>
            </CardHeader>
            <CardContent>
              {certLoading ? (
                <p>Chargement...</p>
              ) : employeeCertifications.length === 0 ? (
                <div className="text-center py-12">
                  <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">Aucune certification</p>
                  <p className="text-muted-foreground mb-4">Ajoutez les certifications de vos employés</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {employeeCertifications.map((cert: EmployeeCertification) => (
                    <div key={cert.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                      <div className="flex-1">
                        <p className="font-medium">{cert.certification?.nom || 'Certification'}</p>
                        <p className="text-sm text-muted-foreground">
                          {cert.profile?.prenom} {cert.profile?.nom} • 
                          {cert.date_obtention && ` Obtenue le ${format(new Date(cert.date_obtention), 'dd/MM/yyyy')}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {cert.date_expiration && (
                          <span className="text-xs text-muted-foreground">
                            Expire: {format(new Date(cert.date_expiration), 'dd/MM/yyyy')}
                          </span>
                        )}
                        <Badge variant={cert.statut === 'valide' ? 'default' : cert.statut === 'expiree' ? 'destructive' : 'secondary'}>
                          {cert.statut === 'valide' ? 'Valide' : cert.statut === 'expiree' ? 'Expirée' : 'En cours'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Plans de Développement</CardTitle>
              <Button size="sm" disabled title="Création disponible prochainement">
                <Plus className="h-4 w-4 mr-2" />
                Nouveau plan
              </Button>
            </CardHeader>
            <CardContent>
              {plansLoading ? (
                <p>Chargement...</p>
              ) : plans.length === 0 ? (
                <div className="text-center py-12">
                  <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">Aucun plan</p>
                  <p className="text-muted-foreground mb-4">Créez des plans de développement individuels</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {plans.map(plan => (
                    <div key={plan.id} className="p-4 border rounded-lg hover:bg-muted/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{plan.titre}</p>
                          <p className="text-sm text-muted-foreground">
                            {plan.profile?.prenom} {plan.profile?.nom}
                            {plan.date_debut && ` • Début: ${format(new Date(plan.date_debut), 'dd/MM/yyyy')}`}
                          </p>
                        </div>
                        <Badge className={PLAN_STATUT_COLORS[plan.statut]}>
                          {PLAN_STATUT_LABELS[plan.statut]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={plan.progression || 0} className="flex-1 h-2" />
                        <span className="text-sm font-medium w-12 text-right">{plan.progression || 0}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </PageDataState>

      <AddEmployeeCertificationDialog
        open={showAddCertif}
        onOpenChange={setShowAddCertif}
      />
    </div>
  );
}
