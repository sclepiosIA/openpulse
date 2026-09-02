import { ExternalLink, Heart, MessageCircle, Share2, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { PlatformBadge } from '@/components/social/PlatformBadge';
import type { SocialPost } from '@/hooks/social/useSocialPosts';

interface Props {
  posts: SocialPost[];
}

export function SocialFeedTimeline({ posts }: Props) {
  if (!posts.length) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Aucun post synchronisé pour l'instant. Lancez une synchronisation depuis les paramètres.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {posts.map((p) => (
        <Card key={p.id}>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-start gap-3">
              {p.media_urls?.[0] && (
                <img
                  src={p.media_urls[0]}
                  alt=""
                  className="h-16 w-16 rounded-md object-cover border"
                  loading="lazy"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <PlatformBadge platform={p.platform} />
                  {p.published_at && (
                    <span>
                      {formatDistanceToNow(new Date(p.published_at), { addSuffix: true, locale: fr })}
                    </span>
                  )}
                  {p.permalink && (
                    <a
                      href={p.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:text-primary"
                    >
                      <ExternalLink className="h-3 w-3" /> Voir
                    </a>
                  )}
                </div>
                {p.message && (
                  <p className="mt-1 text-sm line-clamp-3 whitespace-pre-wrap break-words">
                    {p.message}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Heart className="h-3 w-3 text-rose-500" /> {p.likes_count}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3 w-3 text-sky-500" /> {p.comments_count}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Share2 className="h-3 w-3 text-emerald-500" /> {p.shares_count}
                  </span>
                  {p.views_count > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3 w-3 text-indigo-500" /> {p.views_count}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
