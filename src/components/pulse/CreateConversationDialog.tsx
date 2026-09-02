
import { debug } from '@/lib/debug';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Globe, Lock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useCreatePulseConversation } from '@/hooks/pulse/usePulseConversations';
import { useQuery } from '@tanstack/react-query';
import { fetchEtablissementsLite } from "@/services/etablissements/etablissementsLite";

const formSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(255),
  description: z.string().max(500).optional(),
  visibility: z.enum(['private', 'public']),
  etablissement_id: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (conversationId: string) => void;
}

export function CreateConversationDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateConversationDialogProps) {
  const createConversation = useCreatePulseConversation();

  // Charger les établissements
  const { data: etablissements } = useQuery({
    queryKey: ['etablissements-list'],
    queryFn: fetchEtablissementsLite,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      visibility: 'private',
      etablissement_id: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const result = await createConversation.mutateAsync({
        name: values.name,
        description: values.description,
        visibility: values.visibility,
        etablissement_id: values.etablissement_id && values.etablissement_id !== 'none' ? values.etablissement_id : undefined,
      });
      
      form.reset();
      onSuccess(result.id);
    } catch (error) {
      debug.error('Error creating conversation:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nouvelle conversation</DialogTitle>
          <DialogDescription>
            Créez un nouveau canal de discussion pour votre équipe
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom de la conversation</FormLabel>
                  <FormControl>
                    <Input placeholder="ex: Projet Alpha" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Décrivez l'objectif de cette conversation..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="visibility"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Visibilité</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="grid grid-cols-2 gap-4"
                    >
                      <div className="flex items-center space-x-2 p-4 border rounded-lg cursor-pointer hover:bg-accent">
                        <RadioGroupItem value="private" id="private" />
                        <label htmlFor="private" className="flex items-center gap-2 cursor-pointer flex-1">
                          <Lock className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">Privée</p>
                            <p className="text-xs text-muted-foreground">
                              Visible uniquement par les membres
                            </p>
                          </div>
                        </label>
                      </div>
                      <div className="flex items-center space-x-2 p-4 border rounded-lg cursor-pointer hover:bg-accent">
                        <RadioGroupItem value="public" id="public" />
                        <label htmlFor="public" className="flex items-center gap-2 cursor-pointer flex-1">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">Publique</p>
                            <p className="text-xs text-muted-foreground">
                              Visible par tous les utilisateurs
                            </p>
                          </div>
                        </label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="etablissement_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lier à un établissement (optionnel)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un établissement" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {etablissements?.map((etab) => (
                        <SelectItem key={etab.id} value={etab.id}>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            {etab.nom}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Liez cette conversation à un établissement pour un meilleur suivi
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={createConversation.isPending}>
                {createConversation.isPending ? 'Création...' : 'Créer la conversation'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
