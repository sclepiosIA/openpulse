// Dynamic imports for bundle optimization - loaded on demand
import { loadPdfLibs, loadExcelLibs } from '@/lib/export/dynamicPdfImport';
import type { QuoteResults, SimulationParams } from '@/types/simulator';
import marqueLogoPdf from '@/assets/marque/logo.svg';

// Type aliases for dynamic imports
import type jsPDFType from 'jspdf';
type JsPDF = InstanceType<typeof jsPDFType>;

// ============= STYLES ET COULEURS MARQUE =============

const COLORS = {
  // COULEURS MARQUE OFFICIELLES (du PowerPoint)
  marqueBgLight: [197, 227, 243] as [number, number, number],     // #C5E3F3 - Fond bleu pastel
  marqueTeal: [26, 138, 155] as [number, number, number],          // #1A8A9B - Teal du logo
  marqueNavy: [28, 59, 100] as [number, number, number],           // #1C3B64 - Bleu marine texte
  marqueOrange: [245, 166, 35] as [number, number, number],        // #F5A623 - Orange accents
  
  // Anciennes références remappées
  primaryBlue: [28, 59, 100] as [number, number, number],            // → Navy
  primaryBlueDark: [26, 138, 155] as [number, number, number],       // → Teal
  orange: [245, 166, 35] as [number, number, number],                // → Orange OpenPulse
  tableHeader: [26, 138, 155] as [number, number, number],           // → Teal
  
  // Couleurs standards
  gray: [100, 100, 100] as [number, number, number],
  grayLight: [150, 150, 150] as [number, number, number],
  grayDark: [60, 60, 60] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  black: [0, 0, 0] as [number, number, number],
  tableAlt: [240, 248, 255] as [number, number, number],
  greenPositive: [39, 174, 96] as [number, number, number],
  sectionBg: [248, 250, 252] as [number, number, number],
  
  // Couleurs pour PDF Partenaire - Gains (vert)
  gainsBgLight: [232, 245, 233] as [number, number, number],         // #E8F5E9 - Vert très clair
  gainsBgMedium: [200, 230, 201] as [number, number, number],        // #C8E6C9 - Vert clair
  gainsBgHeader: [165, 214, 167] as [number, number, number],        // #A5D6A7 - Vert moyen
  gainsText: [27, 94, 32] as [number, number, number],               // #1B5E20 - Vert foncé
  
  // Couleurs pour PDF Partenaire - Tarification (orange/bleu)
  tarifBgLight: [255, 243, 224] as [number, number, number],         // #FFF3E0 - Orange clair
  tarifBgMedium: [255, 224, 178] as [number, number, number],        // #FFE0B2 - Orange moyen
  tarifBgBlue: [227, 242, 253] as [number, number, number],          // #E3F2FD - Bleu clair
  tarifBgBlueMedium: [187, 222, 251] as [number, number, number],    // #BBDEFB - Bleu moyen
};

// Format A4 landscape = 297mm x 210mm - OPTIMISED for single page
const STYLES = {
  headerHeight: 18,      // Reduced from 28
  sidebarWidth: 52,      // Vertical sidebar for params
  marginLeft: 8,         // Reduced margins
  marginRight: 8,
  marginTop: 6,
  sectionSpacing: 4,
  lineSpacing: 4,
  fonts: {
    titleMain: 12,       // Reduced from 16
    title: 11,
    sectionTitle: 9,     // Reduced from 11
    tableHeader: 8,      // Reduced from 9
    tableBody: 8,        // Reduced from 9
    bodyLarge: 9,
    body: 8,
    small: 7,
    footer: 7,
  },
  columnWidths: {
    labelWide: 42,       // Reduced for compact layout
    palier: 38,
  },
};

// ============= INTERFACE EXPORT =============

/** Configuration du footer/signataire pour les exports PDF */
export interface DevisFooterConfig {
  signataire_nom?: string;
  signataire_titre?: string;
  company_name?: string;
  email?: string;
}

const DEFAULT_DEVIS_FOOTER: Required<DevisFooterConfig> = {
  signataire_nom: 'Dr Martin Camillei',
  signataire_titre: 'Président',
  company_name: 'OpenPulse',
  email: 'contact@exploitant.example.org',
};

export interface ExportDevisParams {
  results: QuoteResults;
  params: SimulationParams;
  etablissementNom?: string;
  isPremierNiveau: boolean;
  isPartnerExport?: boolean;
  footerConfig?: DevisFooterConfig;
}

// ============= UTILITAIRES DE FORMATAGE =============

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value).replace(/\u00A0/g, ' ').replace(/\u202F/g, ' ');
}

function formatCurrencyCompact(value: number): string {
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value).replace(/\u00A0/g, ' ').replace(/\u202F/g, ' ');
  return formatted + ' EUR';
}

function formatPercentValue(value: number): string {
  return value.toFixed(1).replace('.', ',') + '%';
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(value)).replace(/\u00A0/g, ' ').replace(/\u202F/g, ' ');
}

function getDateString(): string {
  const d = new Date();
  return d.toLocaleDateString('fr-FR');
}

function drawTextLogo(doc: JsPDF, x: number, y: number): void {
  doc.setTextColor(...COLORS.marqueNavy);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('MARQUE', x, y);
  doc.setTextColor(...COLORS.marqueOrange);
  doc.text('I.A', x + 42, y);
}

// ============= CHARGEMENT DU LOGO =============

async function loadLogoBase64(): Promise<string | null> {
  try {
    const response = await fetch(marqueLogoPdf);
    const text = await response.text();
    // For SVG, convert to data URI
    const base64 = btoa(unescape(encodeURIComponent(text)));
    return `data:image/svg+xml;base64,${base64}`;
  } catch {
    return null;
  }
}

// ============= COMPOSANTS PDF =============

function drawProfessionalHeader(
  doc: JsPDF,
  title: string,
  subtitle: string | undefined,
  isPartnerExport: boolean,
  logoBase64: string | null
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const dateStr = getDateString();
  
  // Fond BLANC pour le header
  doc.setFillColor(...COLORS.white);
  doc.rect(0, 0, pageWidth, STYLES.headerHeight, 'F');
  
  // Filet teal fin en haut de page (2mm - reduced)
  doc.setFillColor(...COLORS.marqueTeal);
  doc.rect(0, 0, pageWidth, 2, 'F');
  
  // Logo SVG compact (36x10mm)
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'SVG', STYLES.marginLeft, 4, 36, 10);
    } catch {
      drawTextLogo(doc, STYLES.marginLeft, 12);
    }
  } else {
    drawTextLogo(doc, STYLES.marginLeft, 12);
  }
  
  // Titre du document centré - compact
  doc.setTextColor(...COLORS.marqueNavy);
  doc.setFontSize(STYLES.fonts.titleMain);
  doc.setFont('helvetica', 'bold');
  
  let titleText = title.toUpperCase();
  if (subtitle) {
    titleText += ' - ' + subtitle;
  }
  doc.text(titleText, pageWidth / 2, 10, { align: 'center' });
  
  // Date à droite - compact
  doc.setTextColor(...COLORS.marqueNavy);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(dateStr, pageWidth - STYLES.marginRight, 10, { align: 'right' });
  
  // Badge partenaire - smaller
  if (isPartnerExport) {
    doc.setFillColor(...COLORS.marqueOrange);
    doc.roundedRect(pageWidth - 55, 12, 45, 5, 1, 1, 'F');
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('DOC PARTENAIRE', pageWidth - 32.5, 15.5, { align: 'center' });
  }
  
  // Ligne ORANGE fine sous le header
  doc.setDrawColor(...COLORS.marqueOrange);
  doc.setLineWidth(0.5);
  doc.line(0, STYLES.headerHeight, pageWidth, STYLES.headerHeight);
  
  return STYLES.headerHeight + 2;
}

// Cards horizontales élégantes pour les paramètres
function drawParameterCards(
  doc: JsPDF,
  params: SimulationParams,
  results: QuoteResults,
  startY: number
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const cardWidth = 52;
  const cardHeight = 16;
  const gap = 5;
  
  // 5 cards visuelles
  const cards = [
    { value: formatNumber(results.passagesAnnuels), label: 'passages/an', accent: COLORS.marqueTeal },
    { value: formatPercentValue(params.baseline), label: 'Taux UHCD', accent: COLORS.marqueTeal },
    { value: results.configuration.centerType.name.split(' ').slice(0, 2).join(' '), label: 'Établissement', accent: COLORS.marqueNavy },
    { value: results.configuration.dpiType.name, label: 'DPI', accent: COLORS.marqueNavy },
    { value: formatCurrency(results.paliers[3].roiNet), label: 'Gains nets max', accent: COLORS.greenPositive },
  ];
  
  const totalWidth = cards.length * cardWidth + (cards.length - 1) * gap;
  const startX = (pageWidth - totalWidth) / 2;
  
  cards.forEach((card, i) => {
    const x = startX + i * (cardWidth + gap);
    
    // Fond blanc avec ombre légère
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(200, 210, 220);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, startY, cardWidth, cardHeight, 2, 2, 'FD');
    
    // Barre colorée en haut
    doc.setFillColor(...card.accent);
    doc.roundedRect(x, startY, cardWidth, 2.5, 2, 2, 'F');
    doc.rect(x, startY + 1.5, cardWidth, 1, 'F');
    
    // Valeur principale
    doc.setTextColor(...card.accent);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(card.value, x + cardWidth / 2, startY + 8.5, { align: 'center' });
    
    // Label
    doc.setTextColor(100, 110, 120);
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.text(card.label, x + cardWidth / 2, startY + 13, { align: 'center' });
  });
  
  return startY + cardHeight + 4;
}

function drawProjectionsTableCompact(
  doc: JsPDF,
  autoTable: typeof import('jspdf-autotable').default,
  results: QuoteResults,
  isPremierNiveau: boolean,
  isPartnerExport: boolean,
  startY: number,
  startX: number,
  tableWidth: number
): number {
  const p = results.paliers;
  
  // Titre de section avec style OpenPulse - positioned at startX
  doc.setTextColor(...COLORS.marqueNavy);
  doc.setFontSize(STYLES.fonts.sectionTitle);
  doc.setFont('helvetica', 'bold');
  doc.text('MODELE AU SUCCES - PROJECTIONS PAR PALIER', startX, startY);
  
  // Ligne décorative orange sous le titre
  doc.setDrawColor(...COLORS.marqueOrange);
  doc.setLineWidth(0.5);
  doc.line(startX, startY + 2, startX + 70, startY + 2);
  
  const yPos = startY + 5;
  
  // Construction du tableau compact
  const tableBody: (string | { content: string; styles?: object })[][] = [];
  
  // Objectifs
  tableBody.push([
    { content: 'OBJECTIFS', styles: { fontStyle: 'bold', fillColor: COLORS.sectionBg, textColor: COLORS.primaryBlue } },
    { content: '', styles: { fillColor: COLORS.sectionBg } },
    { content: '', styles: { fillColor: COLORS.sectionBg } },
    { content: '', styles: { fillColor: COLORS.sectionBg } },
    { content: '', styles: { fillColor: COLORS.sectionBg } },
  ]);
  tableBody.push(['Taux UHCD objectif', formatPercentValue(p[0].tauxObjectif), formatPercentValue(p[1].tauxObjectif), formatPercentValue(p[2].tauxObjectif), formatPercentValue(p[3].tauxObjectif)]);
  tableBody.push(['Volume UHCD annuel', formatNumber(p[0].uhcdObjectif), formatNumber(p[1].uhcdObjectif), formatNumber(p[2].uhcdObjectif), formatNumber(p[3].uhcdObjectif)]);
  tableBody.push([
    { content: 'UHCD supplementaires', styles: { fontStyle: 'bold' } },
    { content: '+' + formatNumber(p[0].uhcdSupplementaires), styles: { fontStyle: 'bold', textColor: COLORS.greenPositive } },
    { content: '+' + formatNumber(p[1].uhcdSupplementaires), styles: { fontStyle: 'bold', textColor: COLORS.greenPositive } },
    { content: '+' + formatNumber(p[2].uhcdSupplementaires), styles: { fontStyle: 'bold', textColor: COLORS.greenPositive } },
    { content: '+' + formatNumber(p[3].uhcdSupplementaires), styles: { fontStyle: 'bold', textColor: COLORS.greenPositive } },
  ]);
  
  // Ligne vide de séparation après UHCD supplémentaires
  tableBody.push([
    { content: '', styles: { cellPadding: { top: 4, bottom: 4 } } },
    '', '', '', '',
  ]);
  
  // Gains - Section verte pour le PDF partenaire
  const gainsHeaderBg = isPartnerExport ? COLORS.gainsBgHeader : COLORS.sectionBg;
  const gainsHeaderText = isPartnerExport ? COLORS.gainsText : COLORS.primaryBlue;
  const gainsRowBg = isPartnerExport ? COLORS.gainsBgLight : undefined;
  const gainsTotalBg = isPartnerExport ? COLORS.gainsBgMedium : undefined;
  
  tableBody.push([
    { content: 'GAINS ETABLISSEMENT', styles: { fontStyle: 'bold', fillColor: gainsHeaderBg, textColor: gainsHeaderText } },
    { content: '', styles: { fillColor: gainsHeaderBg } },
    { content: '', styles: { fillColor: gainsHeaderBg } },
    { content: '', styles: { fillColor: gainsHeaderBg } },
    { content: '', styles: { fillColor: gainsHeaderBg } },
  ]);
  tableBody.push([
    { content: 'Gains UHCD', styles: { fillColor: gainsRowBg } },
    { content: formatCurrencyCompact(p[0].roiUhcd), styles: { fillColor: gainsRowBg } },
    { content: formatCurrencyCompact(p[1].roiUhcd), styles: { fillColor: gainsRowBg } },
    { content: formatCurrencyCompact(p[2].roiUhcd), styles: { fillColor: gainsRowBg } },
    { content: formatCurrencyCompact(p[3].roiUhcd), styles: { fillColor: gainsRowBg } },
  ]);
  
  if (!isPremierNiveau) {
    tableBody.push([
      { content: 'Gains Avis spe.', styles: { fillColor: gainsRowBg } },
      { content: formatCurrencyCompact(p[0].roiAvisSpec), styles: { fillColor: gainsRowBg } },
      { content: formatCurrencyCompact(p[1].roiAvisSpec), styles: { fillColor: gainsRowBg } },
      { content: formatCurrencyCompact(p[2].roiAvisSpec), styles: { fillColor: gainsRowBg } },
      { content: formatCurrencyCompact(p[3].roiAvisSpec), styles: { fillColor: gainsRowBg } },
    ]);
    tableBody.push([
      { content: 'Gains CCMU 2+', styles: { fillColor: gainsRowBg } },
      { content: formatCurrencyCompact(p[0].roiCcmu2), styles: { fillColor: gainsRowBg } },
      { content: formatCurrencyCompact(p[1].roiCcmu2), styles: { fillColor: gainsRowBg } },
      { content: formatCurrencyCompact(p[2].roiCcmu2), styles: { fillColor: gainsRowBg } },
      { content: formatCurrencyCompact(p[3].roiCcmu2), styles: { fillColor: gainsRowBg } },
    ]);
    tableBody.push([
      { content: 'Gains CCMU 3+', styles: { fillColor: gainsRowBg } },
      { content: formatCurrencyCompact(p[0].roiCcmu3), styles: { fillColor: gainsRowBg } },
      { content: formatCurrencyCompact(p[1].roiCcmu3), styles: { fillColor: gainsRowBg } },
      { content: formatCurrencyCompact(p[2].roiCcmu3), styles: { fillColor: gainsRowBg } },
      { content: formatCurrencyCompact(p[3].roiCcmu3), styles: { fillColor: gainsRowBg } },
    ]);
    tableBody.push([
      { content: 'Bonus Mono-RUM', styles: { fillColor: gainsRowBg } },
      { content: formatCurrencyCompact(p[0].roiMonoUhcdBonus), styles: { fillColor: gainsRowBg } },
      { content: formatCurrencyCompact(p[1].roiMonoUhcdBonus), styles: { fillColor: gainsRowBg } },
      { content: formatCurrencyCompact(p[2].roiMonoUhcdBonus), styles: { fillColor: gainsRowBg } },
      { content: formatCurrencyCompact(p[3].roiMonoUhcdBonus), styles: { fillColor: gainsRowBg } },
    ]);
  }
  
  // ROI Total → Gains totaux
  tableBody.push([
    { content: 'GAINS TOTAUX', styles: { fontStyle: 'bold', fillColor: gainsTotalBg, textColor: isPartnerExport ? COLORS.gainsText : COLORS.greenPositive } },
    { content: formatCurrencyCompact(p[0].roiTotal), styles: { fontStyle: 'bold', fillColor: gainsTotalBg, textColor: isPartnerExport ? COLORS.gainsText : COLORS.greenPositive } },
    { content: formatCurrencyCompact(p[1].roiTotal), styles: { fontStyle: 'bold', fillColor: gainsTotalBg, textColor: isPartnerExport ? COLORS.gainsText : COLORS.greenPositive } },
    { content: formatCurrencyCompact(p[2].roiTotal), styles: { fontStyle: 'bold', fillColor: gainsTotalBg, textColor: isPartnerExport ? COLORS.gainsText : COLORS.greenPositive } },
    { content: formatCurrencyCompact(p[3].roiTotal), styles: { fontStyle: 'bold', fillColor: gainsTotalBg, textColor: isPartnerExport ? COLORS.gainsText : COLORS.greenPositive } },
  ]);
  
  // Ligne vide de séparation après Gains totaux
  tableBody.push([
    { content: '', styles: { cellPadding: { top: 4, bottom: 4 } } },
    '', '', '', '',
  ]);
  
  // Tarification - Section orange/bleu pour le PDF partenaire
  const tarifHeaderBg = isPartnerExport ? COLORS.tarifBgMedium : COLORS.sectionBg;
  const tarifHeaderText = isPartnerExport ? COLORS.orange : COLORS.primaryBlue;
  
  tableBody.push([
    { content: 'TARIFICATION', styles: { fontStyle: 'bold', fillColor: tarifHeaderBg, textColor: tarifHeaderText } },
    { content: '', styles: { fillColor: tarifHeaderBg } },
    { content: '', styles: { fillColor: tarifHeaderBg } },
    { content: '', styles: { fillColor: tarifHeaderBg } },
    { content: '', styles: { fillColor: tarifHeaderBg } },
  ]);
  
  if (isPartnerExport && results.configuration.resellerType) {
    const markup = results.configuration.resellerType.markup;
    const partnerName = results.configuration.resellerType.name;
    
    // Afficher les frais d'accès et abonnement d'abord
    tableBody.push([
      { content: 'Frais acces', styles: { fillColor: COLORS.tarifBgLight } },
      { content: formatCurrencyCompact(p[0].fraisAcces), styles: { fillColor: COLORS.tarifBgLight } },
      { content: formatCurrencyCompact(p[1].fraisAcces), styles: { fillColor: COLORS.tarifBgLight } },
      { content: formatCurrencyCompact(p[2].fraisAcces), styles: { fillColor: COLORS.tarifBgLight } },
      { content: formatCurrencyCompact(p[3].fraisAcces), styles: { fillColor: COLORS.tarifBgLight } },
    ]);
    tableBody.push([
      { content: 'Abonnement annuel', styles: { fillColor: COLORS.tarifBgLight } },
      { content: formatCurrencyCompact(p[0].prixSolution), styles: { fillColor: COLORS.tarifBgLight } },
      { content: formatCurrencyCompact(p[1].prixSolution), styles: { fillColor: COLORS.tarifBgLight } },
      { content: formatCurrencyCompact(p[2].prixSolution), styles: { fillColor: COLORS.tarifBgLight } },
      { content: formatCurrencyCompact(p[3].prixSolution), styles: { fillColor: COLORS.tarifBgLight } },
    ]);
    
    // Décomposition des encaissements - Marque en bleu
    tableBody.push([
      { content: 'Marque encaisse', styles: { fontStyle: 'bold', fillColor: COLORS.tarifBgBlueMedium, textColor: COLORS.primaryBlue } },
      { content: formatCurrencyCompact(p[0].coutTotal), styles: { fontStyle: 'bold', fillColor: COLORS.tarifBgBlueMedium, textColor: COLORS.primaryBlue } },
      { content: formatCurrencyCompact(p[1].coutTotal), styles: { fontStyle: 'bold', fillColor: COLORS.tarifBgBlueMedium, textColor: COLORS.primaryBlue } },
      { content: formatCurrencyCompact(p[2].coutTotal), styles: { fontStyle: 'bold', fillColor: COLORS.tarifBgBlueMedium, textColor: COLORS.primaryBlue } },
      { content: formatCurrencyCompact(p[3].coutTotal), styles: { fontStyle: 'bold', fillColor: COLORS.tarifBgBlueMedium, textColor: COLORS.primaryBlue } },
    ]);
    // Part partenaire en orange
    tableBody.push([
      { content: partnerName + ' encaisse (+' + (markup * 100).toFixed(0) + '%)', styles: { fontStyle: 'bold', fillColor: COLORS.tarifBgMedium, textColor: COLORS.orange } },
      { content: formatCurrencyCompact(p[0].coutTotal * markup), styles: { fontStyle: 'bold', fillColor: COLORS.tarifBgMedium, textColor: COLORS.orange } },
      { content: formatCurrencyCompact(p[1].coutTotal * markup), styles: { fontStyle: 'bold', fillColor: COLORS.tarifBgMedium, textColor: COLORS.orange } },
      { content: formatCurrencyCompact(p[2].coutTotal * markup), styles: { fontStyle: 'bold', fillColor: COLORS.tarifBgMedium, textColor: COLORS.orange } },
      { content: formatCurrencyCompact(p[3].coutTotal * markup), styles: { fontStyle: 'bold', fillColor: COLORS.tarifBgMedium, textColor: COLORS.orange } },
    ]);
    // Total client
    tableBody.push([
      { content: 'TOTAL facture client', styles: { fontStyle: 'bold', fillColor: COLORS.tarifBgMedium } },
      { content: formatCurrencyCompact(p[0].coutTotalRevendeur), styles: { fontStyle: 'bold', fillColor: COLORS.tarifBgMedium } },
      { content: formatCurrencyCompact(p[1].coutTotalRevendeur), styles: { fontStyle: 'bold', fillColor: COLORS.tarifBgMedium } },
      { content: formatCurrencyCompact(p[2].coutTotalRevendeur), styles: { fontStyle: 'bold', fillColor: COLORS.tarifBgMedium } },
      { content: formatCurrencyCompact(p[3].coutTotalRevendeur), styles: { fontStyle: 'bold', fillColor: COLORS.tarifBgMedium } },
    ]);
  } else {
    tableBody.push(['Frais acces', formatCurrencyCompact(p[0].fraisAcces), formatCurrencyCompact(p[1].fraisAcces), formatCurrencyCompact(p[2].fraisAcces), formatCurrencyCompact(p[3].fraisAcces)]);
    tableBody.push(['Abonnement annuel', formatCurrencyCompact(p[0].prixSolution), formatCurrencyCompact(p[1].prixSolution), formatCurrencyCompact(p[2].prixSolution), formatCurrencyCompact(p[3].prixSolution)]);
    tableBody.push([
      { content: 'Cout total', styles: { fontStyle: 'bold' } },
      { content: formatCurrencyCompact(p[0].coutTotal), styles: { fontStyle: 'bold' } },
      { content: formatCurrencyCompact(p[1].coutTotal), styles: { fontStyle: 'bold' } },
      { content: formatCurrencyCompact(p[2].coutTotal), styles: { fontStyle: 'bold' } },
      { content: formatCurrencyCompact(p[3].coutTotal), styles: { fontStyle: 'bold' } },
    ]);
  }
  
  // Ligne vide de séparation après Coût total
  tableBody.push([
    { content: '', styles: { cellPadding: { top: 4, bottom: 4 } } },
    '', '', '', '',
  ]);
  
  // RENTABILITE (anciennement ROI)
  tableBody.push([
    { content: 'RENTABILITE', styles: { fontStyle: 'bold', fillColor: [255, 243, 224], textColor: COLORS.orange } },
    { content: '', styles: { fillColor: [255, 243, 224] } },
    { content: '', styles: { fillColor: [255, 243, 224] } },
    { content: '', styles: { fillColor: [255, 243, 224] } },
    { content: '', styles: { fillColor: [255, 243, 224] } },
  ]);
  // ROI Net → Gains nets
  tableBody.push([
    { content: 'Gains nets', styles: { fontStyle: 'bold' } },
    { content: formatCurrencyCompact(p[0].roiNet), styles: { fontStyle: 'bold', textColor: p[0].roiNet > 0 ? COLORS.greenPositive : COLORS.grayDark } },
    { content: formatCurrencyCompact(p[1].roiNet), styles: { fontStyle: 'bold', textColor: p[1].roiNet > 0 ? COLORS.greenPositive : COLORS.grayDark } },
    { content: formatCurrencyCompact(p[2].roiNet), styles: { fontStyle: 'bold', textColor: p[2].roiNet > 0 ? COLORS.greenPositive : COLORS.grayDark } },
    { content: formatCurrencyCompact(p[3].roiNet), styles: { fontStyle: 'bold', textColor: p[3].roiNet > 0 ? COLORS.greenPositive : COLORS.grayDark } },
  ]);
  
  // Use tableWidth passed as parameter
  const labelWidth = 36;
  const palierWidth = (tableWidth - labelWidth) / 4;
  
  autoTable(doc, {
    startY: yPos,
    head: [[
      { content: '', styles: { fillColor: COLORS.marqueNavy } },
      { content: 'Palier 1', styles: { halign: 'center', fillColor: COLORS.marqueNavy } },
      { content: 'Palier 2', styles: { halign: 'center', fillColor: COLORS.marqueNavy } },
      { content: 'Palier 3', styles: { halign: 'center', fillColor: COLORS.marqueNavy } },
      { content: 'Palier 4', styles: { halign: 'center', fillColor: COLORS.marqueNavy } },
    ]],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.marqueNavy,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: STYLES.fonts.tableHeader,
      halign: 'center',
      cellPadding: 1.5,
    },
    styles: {
      fontSize: STYLES.fonts.tableBody,
      cellPadding: 1.5,
      lineColor: [180, 200, 210],
      lineWidth: 0.2,
      fillColor: COLORS.white,
    },
    columnStyles: {
      0: { fontStyle: 'normal', cellWidth: labelWidth },
      1: { halign: 'right', cellWidth: palierWidth },
      2: { halign: 'right', cellWidth: palierWidth },
      3: { halign: 'right', cellWidth: palierWidth },
      4: { halign: 'right', cellWidth: palierWidth },
    },
    alternateRowStyles: {
      fillColor: [245, 250, 255],
    },
    margin: { left: startX, right: STYLES.marginRight },
  });
  
  // jsPDF with autoTable adds lastAutoTable property
  return (doc as unknown as import('@/types/global').jsPDFWithAutoTable).lastAutoTable.finalY + 2;
}

function drawExecutiveSummary(
  doc: JsPDF,
  results: QuoteResults,
  isPartnerExport: boolean,
  startY: number
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const p = results.paliers;
  
  // Utiliser le palier 4 comme référence pour les métriques max
  const palier4 = p[3];
  
  // Cadre résumé avec style OpenPulse
  const boxWidth = pageWidth - STYLES.marginLeft - STYLES.marginRight;
  const boxHeight = 24;
  
  // Fond vert clair avec bordure verte
  doc.setFillColor(232, 245, 233);
  doc.setDrawColor(...COLORS.greenPositive);
  doc.setLineWidth(1);
  doc.roundedRect(STYLES.marginLeft, startY, boxWidth, boxHeight, 4, 4, 'FD');
  
  // Titre avec icône
  doc.setTextColor(...COLORS.greenPositive);
  doc.setFontSize(STYLES.fonts.sectionTitle + 1);
  doc.setFont('helvetica', 'bold');
  doc.text('🏆 RÉSUMÉ - Potentiel Maximum (Palier 4)', STYLES.marginLeft + 6, startY + 7);
  
  // Ligne séparatrice orange sous le titre
  doc.setDrawColor(...COLORS.marqueOrange);
  doc.setLineWidth(0.5);
  doc.line(STYLES.marginLeft + 6, startY + 10, STYLES.marginLeft + boxWidth - 6, startY + 10);
  
  // 3 métriques en colonnes
  const metricWidth = (boxWidth - 12) / 3;
  const metricY = startY + 18;
  
  const metrics = [
    { label: 'Gains nets max', value: formatCurrency(palier4.roiNet), color: COLORS.greenPositive },
    { label: 'Coût annuel max', value: formatCurrency(isPartnerExport ? palier4.coutTotalRevendeur : palier4.coutTotal), color: COLORS.marqueNavy },
    { label: 'UHCD supp. max', value: '+' + formatNumber(palier4.uhcdSupplementaires), color: COLORS.greenPositive },
  ];
  
  doc.setFontSize(STYLES.fonts.body);
  
  for (let i = 0; i < metrics.length; i++) {
    const x = STYLES.marginLeft + 6 + i * metricWidth;
    
    doc.setTextColor(...COLORS.grayDark);
    doc.setFont('helvetica', 'normal');
    doc.text(metrics[i].label + ' :', x, metricY);
    
    doc.setTextColor(...metrics[i].color);
    doc.setFont('helvetica', 'bold');
    doc.text(metrics[i].value, x + 28, metricY);
  }
  
  return startY + boxHeight + 4;
}

function drawCompactFooter(doc: JsPDF, footerConfig?: DevisFooterConfig): void {
  const fc = { ...DEFAULT_DEVIS_FOOTER, ...footerConfig };
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerY = pageHeight - 8;
  
  // Fond BLANC pour le footer
  doc.setFillColor(...COLORS.white);
  doc.rect(0, pageHeight - 14, pageWidth, 14, 'F');
  
  // Ligne orange fine au-dessus du footer
  doc.setDrawColor(...COLORS.marqueOrange);
  doc.setLineWidth(0.8);
  doc.line(STYLES.marginLeft, pageHeight - 14, pageWidth - STYLES.marginRight, pageHeight - 14);
  
  // Texte NAVY dans le footer
  doc.setTextColor(...COLORS.marqueNavy);
  doc.setFontSize(STYLES.fonts.footer);
  doc.setFont('helvetica', 'italic');
  doc.text(`Validé par ${fc.signataire_nom}, ${fc.signataire_titre}`, STYLES.marginLeft, footerY);
  
  doc.setFont('helvetica', 'normal');
  doc.text(fc.email, pageWidth / 2, footerY, { align: 'center' });
  
  doc.setFont('helvetica', 'bold');
  doc.text(`${fc.company_name} © ${new Date().getFullYear()}`, pageWidth - STYLES.marginRight, footerY, { align: 'right' });
}

// ============= EXPORT PDF PRINCIPAL =============

export async function exportDevisPDF({
  results,
  params,
  etablissementNom,
  isPremierNiveau,
  isPartnerExport = false,
  footerConfig,
}: ExportDevisParams): Promise<void> {
  // Dynamic import for bundle optimization
  const { jsPDF, autoTable } = await loadPdfLibs();
  
  // Charger le logo
  const logoBase64 = await loadLogoBase64();
  
  // Format A4 LANDSCAPE avec branding OpenPulse épuré
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // FOND BLANC avec léger bleu pastel
  const veryLightBg: [number, number, number] = [250, 253, 255];
  doc.setFillColor(...veryLightBg);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  
  const title = 'Devis Valorisation des Urgences';
  
  // En-tête compact avec logo et titre
  let yPos = drawProfessionalHeader(doc, title, etablissementNom, isPartnerExport, logoBase64);
  
  // Cards horizontales des paramètres
  yPos = drawParameterCards(doc, params, results, yPos + 2);
  
  // Tableau des projections (pleine largeur)
  const tableStartX = STYLES.marginLeft;
  const tableWidth = pageWidth - STYLES.marginLeft - STYLES.marginRight;
  
  // Tableau des projections
  drawProjectionsTableCompact(doc, autoTable, results, isPremierNiveau, isPartnerExport, yPos, tableStartX, tableWidth);
  
  // Footer compact
  drawCompactFooter(doc, footerConfig);
  
  // Nom du fichier
  const cleanName = (etablissementNom || 'Simulation')
    .replace(/[éèêë]/g, 'e')
    .replace(/[àâä]/g, 'a')
    .replace(/[ùûü]/g, 'u')
    .replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o')
    .replace(/[ç]/g, 'c')
    .replace(/\s+/g, '_');
  
  const filename = isPartnerExport
    ? 'Devis_Partenaire_' + cleanName + '_' + new Date().toISOString().slice(0, 10) + '.pdf'
    : 'Devis_' + cleanName + '_' + new Date().toISOString().slice(0, 10) + '.pdf';
  
  doc.save(filename);
}

// ============= EXPORT EXCEL =============

export async function exportDevisExcel({
  results,
  params,
  etablissementNom,
  isPremierNiveau,
  isPartnerExport = false,
  footerConfig,
}: ExportDevisParams): Promise<void> {
  // Dynamic import for bundle optimization
  const { XLSX } = await loadExcelLibs();
  
  const wb = XLSX.utils.book_new();
  const p = results.paliers;
  
  const projectionsData: (string | number)[][] = [
    ['DEVIS VALORISATION DES URGENCES - OPENPULSE'],
    [etablissementNom || 'Simulation'],
    ['Date: ' + getDateString()],
    [''],
    ['PROJECTIONS PAR PALIER'],
    ['', 'Palier 1', 'Palier 2', 'Palier 3', 'Palier 4'],
    ['Taux UHCD objectif (%)', p[0].tauxObjectif, p[1].tauxObjectif, p[2].tauxObjectif, p[3].tauxObjectif],
    ['Volume UHCD annuel', p[0].uhcdObjectif, p[1].uhcdObjectif, p[2].uhcdObjectif, p[3].uhcdObjectif],
    ['UHCD supplementaires', p[0].uhcdSupplementaires, p[1].uhcdSupplementaires, p[2].uhcdSupplementaires, p[3].uhcdSupplementaires],
    ['Gains UHCD (EUR)', p[0].roiUhcd, p[1].roiUhcd, p[2].roiUhcd, p[3].roiUhcd],
  ];
  
  if (!isPremierNiveau) {
    projectionsData.push(['Gains Avis spe. (EUR)', p[0].roiAvisSpec, p[1].roiAvisSpec, p[2].roiAvisSpec, p[3].roiAvisSpec]);
    projectionsData.push(['Gains CCMU 2+ (EUR)', p[0].roiCcmu2, p[1].roiCcmu2, p[2].roiCcmu2, p[3].roiCcmu2]);
    projectionsData.push(['Gains CCMU 3+ (EUR)', p[0].roiCcmu3, p[1].roiCcmu3, p[2].roiCcmu3, p[3].roiCcmu3]);
    projectionsData.push(['Bonus Mono-RUM (EUR)', p[0].roiMonoUhcdBonus, p[1].roiMonoUhcdBonus, p[2].roiMonoUhcdBonus, p[3].roiMonoUhcdBonus]);
  }
  
  projectionsData.push(['ROI Total (EUR)', p[0].roiTotal, p[1].roiTotal, p[2].roiTotal, p[3].roiTotal]);
  projectionsData.push(['']);
  
  if (isPartnerExport && results.configuration.resellerType) {
    const markup = results.configuration.resellerType.markup;
    projectionsData.push(['TARIFICATION PARTENAIRE']);
    projectionsData.push(['Tarif Marque (EUR)', p[0].coutTotal, p[1].coutTotal, p[2].coutTotal, p[3].coutTotal]);
    projectionsData.push(['Marge +' + (markup * 100).toFixed(0) + '% (EUR)', p[0].coutTotal * markup, p[1].coutTotal * markup, p[2].coutTotal * markup, p[3].coutTotal * markup]);
    projectionsData.push(['Prix client (EUR)', p[0].coutTotalRevendeur, p[1].coutTotalRevendeur, p[2].coutTotalRevendeur, p[3].coutTotalRevendeur]);
  } else {
    projectionsData.push(['TARIFICATION']);
    projectionsData.push(['Frais acces (EUR)', p[0].fraisAcces, p[1].fraisAcces, p[2].fraisAcces, p[3].fraisAcces]);
    projectionsData.push(['Abonnement annuel (EUR)', p[0].prixSolution, p[1].prixSolution, p[2].prixSolution, p[3].prixSolution]);
    projectionsData.push(['Cout total (EUR)', p[0].coutTotal, p[1].coutTotal, p[2].coutTotal, p[3].coutTotal]);
  }
  
  projectionsData.push(['']);
  projectionsData.push(['ROI Net (EUR)', p[0].roiNet, p[1].roiNet, p[2].roiNet, p[3].roiNet]);
  projectionsData.push(['ROI (%)', p[0].roiPourcentage, p[1].roiPourcentage, p[2].roiPourcentage, p[3].roiPourcentage]);
  
  const wsProjections = XLSX.utils.aoa_to_sheet(projectionsData);
  wsProjections['!cols'] = [{ wch: 28 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, wsProjections, isPartnerExport ? 'Projections Partenaire' : 'Projections');
  
  const niveauLabel = isPremierNiveau ? 'Premier niveau' : 'Second niveau';
  const paramsDataSheet: (string | number)[][] = [
    ['PARAMETRES DE SIMULATION'],
    [''],
    ['Parametre', 'Valeur'],
    ['Passages annuels', params.passages],
    ['Taux UHCD actuel (%)', params.baseline],
    ['Niveau de valorisation', niveauLabel],
    ['Type etablissement', results.configuration.centerType.name],
    ['Type DPI', results.configuration.dpiType.name],
  ];
  
  if (isPartnerExport && results.configuration.resellerType) {
    paramsDataSheet.push(['Partenaire', results.configuration.resellerType.name]);
    paramsDataSheet.push(['Markup (%)', results.configuration.resellerType.markup * 100]);
  }
  
  paramsDataSheet.push(['']);
  paramsDataSheet.push(['Document genere le', getDateString()]);
  const fc = { ...DEFAULT_DEVIS_FOOTER, ...footerConfig };
  paramsDataSheet.push(['Valide par', `${fc.signataire_nom}, ${fc.signataire_titre} de ${fc.company_name}`]);
  
  const wsParams = XLSX.utils.aoa_to_sheet(paramsDataSheet);
  wsParams['!cols'] = [{ wch: 28 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, wsParams, 'Parametres');
  
  const cleanName = (etablissementNom || 'Simulation')
    .replace(/[éèêë]/g, 'e')
    .replace(/[àâä]/g, 'a')
    .replace(/[ùûü]/g, 'u')
    .replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o')
    .replace(/[ç]/g, 'c')
    .replace(/\s+/g, '_');
  
  const filename = isPartnerExport
    ? 'Devis_Partenaire_' + cleanName + '_' + new Date().toISOString().slice(0, 10) + '.xlsx'
    : 'Devis_' + cleanName + '_' + new Date().toISOString().slice(0, 10) + '.xlsx';
  
  XLSX.writeFile(wb, filename);
}
