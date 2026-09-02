import { format, parseISO } from "date-fns";
import { loadPdfLibs, loadExcelLibs } from "@/lib/export/dynamicPdfImport";

interface RevenuExport {
  mois: string;
  date_prevue?: string | null;
  montant_prevu: number | null;
  notes?: string | null;
  categorie_label?: string | null;
}

function formatRevenuDate(r: RevenuExport): string {
  const dateStr = r.date_prevue || r.mois;
  try {
    const d = parseISO(dateStr.length === 7 ? dateStr + "-01" : dateStr);
    return format(d, "dd/MM/yyyy");
  } catch {
    return dateStr;
  }
}

export async function exportRecettesPDF(revenus: RevenuExport[], dateDebut: Date, dateFin: Date) {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text("Revenus", 14, 20);
  doc.setFontSize(11);
  doc.text(
    `Période: ${format(dateDebut, "dd/MM/yyyy")} - ${format(dateFin, "dd/MM/yyyy")}`,
    14,
    28
  );

  const tableData = revenus.map((r) => [
    formatRevenuDate(r),
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(r.montant_prevu || 0),
    r.categorie_label || "-",
    r.notes || "-",
  ]);

  autoTable(doc, {
    startY: 35,
    head: [["Date", "Montant", "Catégorie", "Intitulé Qonto"]],
    body: tableData,
    theme: "striped",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 130, 246] },
  });

  const total = revenus.reduce((sum, r) => sum + (r.montant_prevu || 0), 0);
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY || 35;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(
    `Total: ${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(total)}`,
    14,
    finalY + 10
  );

  doc.save(`revenus-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}

export async function exportRecettesExcel(revenus: RevenuExport[], dateDebut: Date, dateFin: Date) {
  const { XLSX } = await loadExcelLibs();

  const data = revenus.map((r) => ({
    Date: formatRevenuDate(r),
    Montant: r.montant_prevu || 0,
    Catégorie: r.categorie_label || "-",
    "Intitulé Qonto": r.notes || "",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 12 },
    { wch: 15 },
    { wch: 30 },
    { wch: 40 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Revenus");

  const stats = [
    ["Statistiques"],
    [""],
    ["Période", `${format(dateDebut, "dd/MM/yyyy")} - ${format(dateFin, "dd/MM/yyyy")}`],
    ["Nombre de revenus", revenus.length],
    ["Total prévu", revenus.reduce((sum, r) => sum + (r.montant_prevu || 0), 0)],
  ];

  const wsStats = XLSX.utils.aoa_to_sheet(stats);
  XLSX.utils.book_append_sheet(wb, wsStats, "Statistiques");

  XLSX.writeFile(wb, `revenus-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
}
