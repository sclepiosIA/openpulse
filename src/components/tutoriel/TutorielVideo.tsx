import { Play } from 'lucide-react'

interface TutorielVideoProps {
  url: string
  title: string
}

export function TutorielVideo({ url, title }: TutorielVideoProps) {
  // Convert YouTube watch URL to embed URL if needed
  const embedUrl = url.includes('youtube.com/watch?v=') 
    ? url.replace('youtube.com/watch?v=', 'youtube.com/embed/')
    : url.includes('youtu.be/')
    ? url.replace('youtu.be/', 'youtube.com/embed/')
    : url

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Play className="h-4 w-4" />
        <span>Vidéo tutoriel : {title}</span>
      </div>
      <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
        <iframe
          src={embedUrl}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      </div>
    </div>
  )
}
