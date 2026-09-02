import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, Upload, Copy, MoreVertical } from 'lucide-react';
import type { Node, Edge } from '@xyflow/react';
import { toast } from 'sonner';
import { useCreateWorkflow } from '@/hooks/workflows/useWorkflows';
import { useNavigate } from 'react-router-dom';
import type { WorkflowTriggerType } from '@/types/workflow';

interface Props {
  workflowId: string;
  nom: string;
  description?: string | null;
  triggerType: WorkflowTriggerType;
  triggerConfig?: Record<string, unknown>;
  nodes: Node[];
  edges: Edge[];
}

const FORMAT = 'marque.workflow.v1' as const;

export function WorkflowImportExportMenu({ workflowId, nom, description, triggerType, triggerConfig, nodes, edges }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const createMut = useCreateWorkflow();
  const navigate = useNavigate();

  const handleExport = () => {
    const payload = {
      format: FORMAT,
      nom,
      description: description ?? null,
      trigger_type: triggerType,
      trigger_config: triggerConfig ?? {},
      graph: { nodes, edges },
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-${nom.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Workflow exporté');
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed?.graph?.nodes || !parsed?.trigger_type || !parsed?.nom) {
        throw new Error('Format invalide (champs requis : nom, trigger_type, graph)');
      }
      const res = await createMut.mutateAsync({
        nom: `${parsed.nom} (importé)`,
        trigger_type: parsed.trigger_type,
        description: parsed.description ?? undefined,
        graph: parsed.graph,
      });
      toast.success(`Workflow "${parsed.nom}" importé`);
      navigate(`/automatisations/${res.id}/edit`);
    } catch (err: any) {
      toast.error(`Import échoué : ${err.message ?? 'JSON invalide'}`);
    }
  };

  const handleDuplicate = async () => {
    try {
      const res = await createMut.mutateAsync({
        nom: `${nom} (copie)`,
        trigger_type: triggerType,
        description: description ?? undefined,
        graph: { nodes: nodes as any, edges: edges as any },
      });
      toast.success('Workflow dupliqué');
      navigate(`/automatisations/${res.id}/edit`);
    } catch (err: any) {
      toast.error(`Duplication échouée : ${err.message}`);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImportFile(f);
          e.target.value = '';
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" /> Exporter (JSON)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" /> Importer (nouveau)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleDuplicate}>
            <Copy className="h-4 w-4 mr-2" /> Dupliquer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
