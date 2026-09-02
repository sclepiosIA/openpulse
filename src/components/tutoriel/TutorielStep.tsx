import { TutorielStep as TutorielStepType } from '@/types/tutoriel'
import { TutorielTip } from './TutorielTip'
import { TutorielWarning } from './TutorielWarning'
import { TutorielScreenshot } from './TutorielScreenshot'
import { ExternalLink, Lightbulb } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface TutorielStepProps {
  step: TutorielStepType
  index: number
  moduleId: string
  moduleIcon: string
}

export function TutorielStep({ step, index, moduleId, moduleIcon }: TutorielStepProps) {
  return (
    <div className="relative pl-6 pb-6 border-l-2 border-border last:border-l-0 last:pb-0">
      {/* Step number indicator */}
      <div className="absolute -left-2.5 top-0 w-5 h-5 rounded-full bg-background border-2 border-primary flex items-center justify-center">
        <span className="text-xs font-medium text-primary">{index + 1}</span>
      </div>
      
      <div className="space-y-3">
        <h3 className="font-medium text-lg">{step.title}</h3>
        <p className="text-muted-foreground leading-relaxed">{step.content}</p>
        
        {/* Contenu détaillé enrichi */}
        {step.detailedContent && (
          <div className="mt-4 p-4 bg-muted/50 rounded-lg border-l-4 border-primary/50">
            <div className="text-sm text-muted-foreground leading-relaxed space-y-2 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{step.detailedContent}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Exemple concret */}
        {step.example && (
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-2">
              <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                <span className="font-semibold">Exemple : </span>{step.example}
              </p>
            </div>
          </div>
        )}

        {/* Liens connexes */}
        {step.relatedLinks && step.relatedLinks.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {step.relatedLinks.map(link => (
              <a 
                key={link.href} 
                href={link.href} 
                className="inline-flex items-center gap-1 text-xs text-primary underline hover:text-primary/80 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3 w-3" />
                {link.label}
              </a>
            ))}
          </div>
        )}
        
        {/* Screenshot de l'étape si disponible */}
        {step.screenshot && (
          <div className="my-4">
            <TutorielScreenshot 
              src={step.screenshot} 
              alt={step.screenshotAlt || step.title}
              size="medium"
            />
          </div>
        )}
        
        {step.tip && <TutorielTip content={step.tip} />}
        {step.warning && <TutorielWarning content={step.warning} />}
      </div>
    </div>
  )
}
