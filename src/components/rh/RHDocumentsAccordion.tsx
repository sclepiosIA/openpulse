import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { debug } from "@/lib/debug";

interface RHDocument {
  id: string;
  titre: string;
  type_document: string;
  description?: string | null;
  date_document?: string | null;
  created_at: string;
  taille_octets?: number | null;
}

interface Section {
  value: string;
  type: string;
  label: string;
  iconClass: string;
  showDescription?: boolean;
}

const SECTIONS: Section[] = [
  { value: "bulletins", type: "bulletin_salaire", label: "Bulletins de salaire", iconClass: "text-primary" },
  { value: "contrats", type: "contrat", label: "Contrats", iconClass: "text-blue-600" },
  { value: "attestations", type: "attestation", label: "Attestations", iconClass: "text-green-600" },
  { value: "autres", type: "autre", label: "Autres documents", iconClass: "text-foreground", showDescription: true },
];

interface Props {
  documents: RHDocument[] | undefined;
  documentsLoading: boolean;
  handleOpenDocument: (doc: RHDocument) => void;
  deleteDocument: (id: string) => Promise<unknown>;
}

function formatDate(d: string) {
  return format(new Date(d), "dd MMM yyyy", { locale: fr });
}

function DocSection({ section, docs, handleOpenDocument, deleteDocument }: {
  section: Section;
  docs: RHDocument[];
  handleOpenDocument: (doc: RHDocument) => void;
  deleteDocument: (id: string) => Promise<unknown>;
}) {
  if (docs.length === 0) return null;
  return (
    <AccordionItem value={section.value} className="border rounded-lg px-4">
      <AccordionTrigger className="hover:no-underline">
        <div className="flex items-center gap-2">
          <FileText className={`h-5 w-5 ${section.iconClass}`} />
          <span className="font-medium">{section.label}</span>
          <Badge variant="secondary">{docs.length}</Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titre</TableHead>
              {section.showDescription && <TableHead>Description</TableHead>}
              <TableHead>Date</TableHead>
              <TableHead>Taille</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map(doc => (
              <TableRow key={doc.id}>
                <TableCell className="font-medium">{doc.titre}</TableCell>
                {section.showDescription && (
                  <TableCell className="text-sm text-muted-foreground">{doc.description || "-"}</TableCell>
                )}
                <TableCell>{formatDate(doc.date_document || doc.created_at)}</TableCell>
                <TableCell>{doc.taille_octets ? `${(doc.taille_octets / 1024).toFixed(1)} KB` : "-"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleOpenDocument(doc)}>👁️</Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        try { await deleteDocument(doc.id); }
                        catch (error) { debug.error("Erreur suppression:", error); }
                      }}
                    >🗑️</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AccordionContent>
    </AccordionItem>
  );
}

export function RHDocumentsAccordion({ documents, documentsLoading, handleOpenDocument, deleteDocument }: Props) {
  if (documentsLoading) {
    return (
      <Card>
        <CardContent className="pt-6"><Skeleton className="h-32 w-full" /></CardContent>
      </Card>
    );
  }
  if (!documents || documents.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">Aucun document</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Commencez par ajouter un document pour cet employé
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <Accordion type="multiple" className="space-y-4">
      {SECTIONS.map(section => (
        <DocSection
          key={section.value}
          section={section}
          docs={documents.filter(d => d.type_document === section.type)}
          handleOpenDocument={handleOpenDocument}
          deleteDocument={deleteDocument}
        />
      ))}
    </Accordion>
  );
}
