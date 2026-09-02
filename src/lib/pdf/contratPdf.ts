/**
 * Génération PDF des contrats — extrait de ContratDetail pour réutilisabilité.
 * Construit le HTML via DOM (XSS-safe : textContent partout) puis html2canvas + jsPDF.
 */
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CONTRAT_TYPE_LABELS } from '@/types/contrats';

interface ContratPdfPayload {
  id: string;
  titre: string;
  numero?: string | null;
  client_nom: string;
  client_adresse?: string | null;
  client_siret?: string | null;
  type: keyof typeof CONTRAT_TYPE_LABELS;
  montant_annuel_ht: number;
  montant_mensuel_ht: number;
  date_debut?: string | null;
  date_fin?: string | null;
  conditions_particulieres?: string | null;
}

const formatMontant = (montant: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(montant);

function buildContratNode(contrat: ContratPdfPayload): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'padding: 40px; font-family: Arial, sans-serif; max-width: 800px;';

  const title = document.createElement('h1');
  title.style.cssText = 'color: #333; margin-bottom: 8px;';
  title.textContent = contrat.titre;
  wrapper.appendChild(title);

  const numero = document.createElement('p');
  numero.style.cssText = 'color: #666; margin-bottom: 24px;';
  numero.textContent = `Contrat n° ${contrat.numero || 'Non numéroté'}`;
  wrapper.appendChild(numero);

  // Client
  const clientSection = document.createElement('div');
  clientSection.style.marginBottom = '24px';
  const clientTitle = document.createElement('h2');
  clientTitle.style.cssText = 'font-size: 16px; color: #333; margin-bottom: 8px;';
  clientTitle.textContent = 'Client';
  clientSection.appendChild(clientTitle);

  const clientNom = document.createElement('p');
  clientNom.style.margin = '0';
  clientNom.textContent = contrat.client_nom;
  clientSection.appendChild(clientNom);

  if (contrat.client_adresse) {
    const p = document.createElement('p');
    p.style.cssText = 'margin: 4px 0; color: #666;';
    p.textContent = contrat.client_adresse;
    clientSection.appendChild(p);
  }
  if (contrat.client_siret) {
    const p = document.createElement('p');
    p.style.cssText = 'margin: 4px 0; color: #666;';
    p.textContent = `SIRET: ${contrat.client_siret}`;
    clientSection.appendChild(p);
  }
  wrapper.appendChild(clientSection);

  // Détails
  const detailsSection = document.createElement('div');
  detailsSection.style.marginBottom = '24px';
  const detailsTitle = document.createElement('h2');
  detailsTitle.style.cssText = 'font-size: 16px; color: #333; margin-bottom: 8px;';
  detailsTitle.textContent = 'Détails du contrat';
  detailsSection.appendChild(detailsTitle);

  const addDetail = (label: string, value: string) => {
    const p = document.createElement('p');
    p.style.margin = '4px 0';
    const strong = document.createElement('strong');
    strong.textContent = `${label}: `;
    p.appendChild(strong);
    p.appendChild(document.createTextNode(value));
    detailsSection.appendChild(p);
  };

  addDetail('Type', CONTRAT_TYPE_LABELS[contrat.type]);
  addDetail('Montant annuel HT', formatMontant(contrat.montant_annuel_ht));
  addDetail('Montant mensuel HT', formatMontant(contrat.montant_mensuel_ht));
  if (contrat.date_debut) {
    addDetail('Date de début', format(new Date(contrat.date_debut), 'dd MMMM yyyy', { locale: fr }));
  }
  if (contrat.date_fin) {
    addDetail('Date de fin', format(new Date(contrat.date_fin), 'dd MMMM yyyy', { locale: fr }));
  }
  wrapper.appendChild(detailsSection);

  // Conditions
  if (contrat.conditions_particulieres) {
    const conditionsSection = document.createElement('div');
    conditionsSection.style.marginBottom = '24px';
    const conditionsTitle = document.createElement('h2');
    conditionsTitle.style.cssText = 'font-size: 16px; color: #333; margin-bottom: 8px;';
    conditionsTitle.textContent = 'Conditions particulières';
    conditionsSection.appendChild(conditionsTitle);
    const text = document.createElement('p');
    text.style.cssText = 'margin: 0; white-space: pre-wrap;';
    text.textContent = contrat.conditions_particulieres;
    conditionsSection.appendChild(text);
    wrapper.appendChild(conditionsSection);
  }

  // Signatures
  const signaturesSection = document.createElement('div');
  signaturesSection.style.cssText = 'margin-top: 48px; display: flex; justify-content: space-between;';
  ['Le Prestataire', 'Le Client'].forEach((party) => {
    const block = document.createElement('div');
    block.style.width = '45%';
    const partyP = document.createElement('p');
    partyP.style.marginBottom = '48px';
    const strong = document.createElement('strong');
    strong.textContent = party;
    partyP.appendChild(strong);
    block.appendChild(partyP);
    const signLine = document.createElement('p');
    signLine.style.cssText = 'border-top: 1px solid #333; padding-top: 8px;';
    signLine.textContent = 'Signature';
    block.appendChild(signLine);
    signaturesSection.appendChild(block);
  });
  wrapper.appendChild(signaturesSection);

  const container = document.createElement('div');
  container.appendChild(wrapper);
  return container;
}

export async function exportContratPdf(contrat: ContratPdfPayload): Promise<void> {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);

  const node = buildContratNode(contrat);
  document.body.appendChild(node);

  try {
    const canvas = await html2canvas(node, { scale: 2, useCORS: true, logging: false });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.save(`contrat_${contrat.numero || contrat.id}.pdf`);
  } finally {
    document.body.removeChild(node);
  }
}
