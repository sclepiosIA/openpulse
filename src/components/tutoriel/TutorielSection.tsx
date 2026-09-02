import { TutorielSection as TutorielSectionType } from '@/types/tutoriel'
import { TutorielStep } from './TutorielStep'
import { TutorielVideo } from './TutorielVideo'
import { TutorielScreenshot } from './TutorielScreenshot'
import { TutorielLivePreview } from './TutorielLivePreview'

interface TutorielSectionProps {
  section: TutorielSectionType
  index: number
  moduleId: string
  moduleIcon: string
}

export function TutorielSection({ section, index, moduleId, moduleIcon }: TutorielSectionProps) {
  return (
    <section id={section.id} className="scroll-mt-20">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-semibold">
            {index + 1}
          </span>
          <h2 className="text-2xl font-semibold">{section.title}</h2>
        </div>
        <p className="text-muted-foreground ml-11">{section.description}</p>
      </div>

      {/* Screenshot réel ou Live Preview */}
      <div className="mb-8 ml-11">
        {section.screenshot ? (
          <TutorielScreenshot 
            src={section.screenshot} 
            alt={section.screenshotAlt || section.title}
            size="full"
          />
        ) : (
          <TutorielLivePreview
            moduleId={moduleId}
            sectionId={section.id}
            fallbackTitle={section.title}
            fallbackIcon={moduleIcon}
          />
        )}
      </div>

      {section.videoUrl && (
        <div className="mb-8 ml-11">
          <TutorielVideo 
            url={section.videoUrl} 
            title={section.videoTitle || section.title} 
          />
        </div>
      )}

      <div className="space-y-6 ml-11">
        {section.steps.map((step, stepIndex) => (
          <TutorielStep 
            key={step.id} 
            step={step} 
            index={stepIndex}
            moduleId={moduleId}
            moduleIcon={moduleIcon}
          />
        ))}
      </div>
    </section>
  )
}
