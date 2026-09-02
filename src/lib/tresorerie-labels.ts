export const STATUT_FACTURE_LABELS: Record<string, string> = {
  non_emise: "Non émise",
  emise: "Émise",
  en_attente: "En attente",
  negociation: "Négociation",
  negociation_avancee: "Nég. avancée",
  payee: "Payée",
  encaissee: "Encaissée",
  annulee: "Annulée",
  ok: "OK"
};

export const STATUT_FACTURE_COLORS: Record<string, string> = {
  non_emise: "bg-gray-100 text-gray-700",
  emise: "bg-blue-100 text-blue-700",
  en_attente: "bg-yellow-100 text-yellow-700",
  negociation: "bg-orange-100 text-orange-700",
  negociation_avancee: "bg-orange-200 text-orange-800",
  payee: "bg-green-100 text-green-700",
  encaissee: "bg-emerald-100 text-emerald-700",
  annulee: "bg-red-100 text-red-700",
  ok: "bg-blue-50 text-blue-600"
};

export const TYPE_OPERATION_LABELS: Record<string, string> = {
  recette: "Recette",
  depense: "Dépense"
};

export const STATUT_OPERATION_LABELS: Record<string, string> = {
  prevu: "Prévu",
  realise: "Réalisé",
  comptabilise: "Comptabilisé"
};
