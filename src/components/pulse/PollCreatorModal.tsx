import { useState, useCallback } from 'react';
import { BarChart3, Plus, Trash2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCreatePulsePoll, useUpdatePollMessage } from '@/hooks/pulse/usePulsePolls';
import { useSendPulseMessage } from '@/hooks/pulse/usePulseMessages';

interface PollCreatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
}

export function PollCreatorModal({
  open,
  onOpenChange,
  conversationId,
}: PollCreatorModalProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isMultipleChoice, setIsMultipleChoice] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const createPoll = useCreatePulsePoll();
  const sendMessage = useSendPulseMessage();
  const updatePollMessage = useUpdatePollMessage();

  const handleAddOption = useCallback(() => {
    if (options.length < 10) {
      setOptions(prev => [...prev, '']);
    }
  }, [options.length]);

  const handleRemoveOption = useCallback((index: number) => {
    if (options.length > 2) {
      setOptions(prev => prev.filter((_, i) => i !== index));
    }
  }, [options.length]);

  const handleOptionChange = useCallback((index: number, value: string) => {
    setOptions(prev => prev.map((opt, i) => i === index ? value : opt));
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmedQuestion = question.trim();
    const validOptions = options.map(o => o.trim()).filter(o => o.length > 0);

    if (!trimmedQuestion) return;
    if (validOptions.length < 2) return;

    createPoll.mutate({
      conversationId,
      question: trimmedQuestion,
      options: validOptions,
      isMultipleChoice,
      isAnonymous,
    }, {
      onSuccess: (poll) => {
        // Envoyer directement le message avec la référence poll
        const content = `#[${trimmedQuestion}](poll:${poll.id})`;
        
        sendMessage.mutate({
          conversation_id: conversationId,
          content,
          mentions: [],
        }, {
          onSuccess: (message) => {
            // Lier le poll au message
            if (message?.id) {
              updatePollMessage.mutate({
                pollId: poll.id,
                messageId: message.id,
              });
            }
          },
        });
        
        // Reset form
        setQuestion('');
        setOptions(['', '']);
        setIsMultipleChoice(false);
        setIsAnonymous(false);
        onOpenChange(false);
      },
    });
  }, [question, options, isMultipleChoice, isAnonymous, conversationId, createPoll, sendMessage, updatePollMessage, onOpenChange]);

  const isValid = question.trim().length > 0 && options.filter(o => o.trim()).length >= 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Créer un sondage
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Question */}
          <div className="space-y-2">
            <Label htmlFor="poll-question">Question</Label>
            <Input
              id="poll-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Posez votre question..."
              autoFocus
            />
          </div>

          {/* Options */}
          <div className="space-y-2">
            <Label>Options</Label>
            <div className="space-y-2">
              {options.map((option, index) => (
                // stable: poll options are positional editable inputs
                <div key={`poll-option-${index}`} className="flex items-center gap-2">
                  <Input
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                  />
                  {options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 flex-shrink-0"
                      onClick={() => handleRemoveOption(index)} aria-label="Supprimer">
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 10 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddOption}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter une option
              </Button>
            )}
          </div>

          {/* Settings */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <Label htmlFor="multiple-choice" className="cursor-pointer">
                Choix multiples autorisés
              </Label>
              <Switch
                id="multiple-choice"
                checked={isMultipleChoice}
                onCheckedChange={setIsMultipleChoice}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="anonymous" className="cursor-pointer">
                Vote anonyme
              </Label>
              <Switch
                id="anonymous"
                checked={isAnonymous}
                onCheckedChange={setIsAnonymous}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || createPoll.isPending}
          >
            {createPoll.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <BarChart3 className="h-4 w-4 mr-2" />
            )}
            Créer le sondage
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
