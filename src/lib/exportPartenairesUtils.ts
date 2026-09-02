import { Partenaire } from "@/hooks/crm/usePartenaires";
import Papa from "papaparse";
import { loadPdfLibs, loadExcelLibs } from "@/lib/export/dynamicPdfImport";

/**
 * Exporte les partenaires au format CSV
 */
export function exportPartenairesToCSV(partenaires: Partenaire[], filename = "partenaires.csv") {
  const data = partenaires.map((p) => ({
    Nom: p.nom,
    Type: p.type_partenaire,
    "Sous-type": p.sous_type || "",
    Statut: p.statut_relation,
    Ville: p.ville || "",
    Région: p.region || "",
    Pays: p.pays || "",
    Email: p.email || "",
    Téléphone: p.telephone || "",
    "Site web": p.site_web || "",
    Responsable: p.responsable ? `${p.responsable.prenom} ${p.responsable.nom}` : "",
    "Dernier contact": p.dernier_contact || "",
    "Prochaine action": p.prochaine_action || "",
    "Valeur partenariat": p.valeur_partenariat || "",
    "Score engagement": p.engagement_score || "",
    "Date création": p.created_at,
  }));

  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

/**
 * Exporte les partenaires au format Excel
 */
export async function exportPartenairesToExcel(partenaires: Partenaire[], filename = "partenaires.xlsx") {
  const { XLSX } = await loadExcelLibs();

  // Onglet Partenaires
  const partenairesData = partenaires.map((p) => ({
    Nom: p.nom,
    Type: p.type_partenaire,
    "Sous-type": p.sous_type || "",
    Statut: p.statut_relation,
    Ville: p.ville || "",
    Région: p.region || "",
    Pays: p.pays || "",
    Email: p.email || "",
    Téléphone: p.telephone || "",
    "Site web": p.site_web || "",
    Responsable: p.responsable ? `${p.responsable.prenom} ${p.responsable.nom}` : "",
    "Dernier contact": p.dernier_contact || "",
    "Prochaine action": p.prochaine_action || "",
    "Valeur partenariat": p.valeur_partenariat || "",
    "Score engagement": p.engagement_score || "",
    "Date création": new Date(p.created_at).toLocaleDateString("fr-FR"),
  }));

  // Onglet Statistiques
  const statsData = [
    { Indicateur: "Total partenaires", Valeur: partenaires.length },
    { Indicateur: "Actifs", Valeur: partenaires.filter((p) => p.statut_relation === "actif").length },
    { Indicateur: "Prospects", Valeur: partenaires.filter((p) => p.statut_relation === "prospect").length },
    { Indicateur: "Institutionnels", Valeur: partenaires.filter((p) => p.type_partenaire === "institutionnel").length },
    { Indicateur: "Industriels", Valeur: partenaires.filter((p) => p.type_partenaire === "industriel").length },
    { Indicateur: "Prestataires", Valeur: partenaires.filter((p) => p.type_partenaire === "prestataire").length },
    { 
      Indicateur: "Valeur totale partenariats", 
      Valeur: `${partenaires.reduce((sum, p) => sum + (p.valeur_partenariat || 0), 0).toLocaleString("fr-FR")}€` 
    },
    { 
      Indicateur: "Score engagement moyen", 
      Valeur: partenaires.length > 0 
        ? `${Math.round(partenaires.reduce((sum, p) => sum + (p.engagement_score || 0), 0) / partenaires.length)}%`
        : "0%" 
    },
  ];

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(partenairesData);
  const ws2 = XLSX.utils.json_to_sheet(statsData);

  XLSX.utils.book_append_sheet(wb, ws1, "Partenaires");
  XLSX.utils.book_append_sheet(wb, ws2, "Statistiques");

  XLSX.writeFile(wb, filename);
}

/**
 * Exporte les partenaires au format PDF
 */
export async function exportPartenairesToPDF(partenaires: Partenaire[], filename = "partenaires.pdf") {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF();

  // Titre
  doc.setFontSize(18);
  doc.text("Liste des Partenaires", 14, 20);

  // Statistiques
  doc.setFontSize(12);
  doc.text(`Total: ${partenaires.length} partenaires`, 14, 30);
  doc.text(`Actifs: ${partenaires.filter((p) => p.statut_relation === "actif").length}`, 14, 37);
  doc.text(
    `Valeur totale: ${partenaires.reduce((sum, p) => sum + (p.valeur_partenariat || 0), 0).toLocaleString("fr-FR")}€`,
    14,
    44
  );

  // Tableau
  const tableData = partenaires.map((p) => [
    p.nom,
    p.type_partenaire,
    p.statut_relation,
    p.ville || "-",
    p.responsable ? `${p.responsable.prenom} ${p.responsable.nom}` : "-",
    p.valeur_partenariat ? `${(p.valeur_partenariat / 1000).toFixed(0)}k€` : "-",
    p.engagement_score ? `${p.engagement_score}%` : "-",
  ]);

  autoTable(doc, {
    head: [["Nom", "Type", "Statut", "Ville", "Responsable", "Valeur", "Engagement"]],
    body: tableData,
    startY: 55,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246] },
  });

  doc.save(filename);
}
