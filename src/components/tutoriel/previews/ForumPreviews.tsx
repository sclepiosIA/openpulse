import { memo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare,
  Users,
  ThumbsUp,
  Eye,
  Pin,
  User,
  Reply,
  Award,
  CheckCircle2,
  MessageCircle,
  Plus,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { TutorielCountUpAnimation } from '../TutorielCountUpAnimation'

// ============================================
// FORUM POST LIST PREVIEW
// ============================================

export const ForumPostListPreview = memo(() => {
  const posts = [
    { 
      id: 1,
      title: 'Bonnes pratiques pour un déploiement en grand compte',
      author: 'Marie Dupont',
      avatar: null,
      category: 'Déploiement',
      tags: ['Grand compte', 'Formation'],
      replies: 12,
      views: 245,
      likes: 8,
      isPinned: true,
      isResolved: true,
      lastActivity: 'Il y a 2h'
    },
    { 
      id: 2,
      title: 'Comment optimiser les imports de données personnelles ?',
      author: 'Thomas Bernard',
      avatar: null,
      category: 'Technique',
      tags: ['Import', 'Données'],
      replies: 7,
      views: 128,
      likes: 5,
      isPinned: false,
      isResolved: false,
      lastActivity: 'Il y a 5h'
    },
    { 
      id: 3,
      title: 'Retour d\'expérience : migration depuis ancien système',
      author: 'Sophie Martin',
      avatar: null,
      category: 'Retour d\'expérience',
      tags: ['Migration', 'Témoignage'],
      replies: 15,
      views: 312,
      likes: 22,
      isPinned: false,
      isResolved: false,
      lastActivity: 'Hier'
    },
  ]

  const categoryColors: Record<string, string> = {
    'Déploiement': 'bg-blue-500/10 text-blue-600 border-blue-200',
    'Technique': 'bg-purple-500/10 text-purple-600 border-purple-200',
    'Retour d\'expérience': 'bg-green-500/10 text-green-600 border-green-200',
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MessageSquare className="h-4 w-4 text-primary" />
          Discussions récentes
        </div>
        <Button size="sm" className="h-7">
          <Plus className="h-3 w-3 mr-1" />
          Nouveau sujet
        </Button>
      </div>
      <div className="space-y-2">
        {posts.map((post, index) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.12 }}
          >
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: index * 0.12 + 0.1, type: 'spring' }}
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarFallback>
                        {post.author.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                  </motion.div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {post.isPinned && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: index * 0.12 + 0.15, type: 'spring' }}
                        >
                          <Pin className="h-3 w-3 text-orange-500" />
                        </motion.div>
                      )}
                      <span className="text-sm font-medium truncate">{post.title}</span>
                      {post.isResolved && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: index * 0.12 + 0.2, type: 'spring' }}
                        >
                          <Badge variant="outline" className="text-[10px] gap-1 text-green-600 border-green-200">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            Résolu
                          </Badge>
                        </motion.div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] ${categoryColors[post.category] || ''}`}>
                        {post.category}
                      </Badge>
                      {post.tags.map((tag) => (
                        <Badge key={`${post.title}-tag-${tag}`} variant="secondary" className="text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {post.author}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        <TutorielCountUpAnimation value={post.replies} delay={index * 120 + 200} duration={600} />
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        <TutorielCountUpAnimation value={post.views} delay={index * 120 + 300} duration={600} />
                      </span>
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3" />
                        <TutorielCountUpAnimation value={post.likes} delay={index * 120 + 400} duration={600} />
                      </span>
                      <span className="ml-auto">{post.lastActivity}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  )
})
ForumPostListPreview.displayName = 'ForumPostListPreview'

// ============================================
// FORUM POST DETAIL PREVIEW
// ============================================

export const ForumPostDetailPreview = memo(() => {
  const [showReplies, setShowReplies] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShowReplies(true), 800)
    return () => clearTimeout(timer)
  }, [])

  const replies = [
    { author: 'Thomas B.', content: 'Excellente question ! Nous avons eu le même défi lors de notre déploiement...', time: 'Il y a 3h', likes: 5, isBestAnswer: true },
    { author: 'Sophie M.', content: 'Je confirme, la documentation officielle est très utile sur ce point.', time: 'Il y a 2h', likes: 2, isBestAnswer: false },
  ]

  return (
    <div className="space-y-4">
      {/* Original post */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary text-primary-foreground">MD</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h4 className="font-semibold">Bonnes pratiques pour un déploiement en grand compte</h4>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <span>Marie Dupont</span>
                  <span>•</span>
                  <span>Il y a 5h</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Bonjour à tous, nous préparons le déploiement de la solution dans notre organisation. 
              Quelles sont vos recommandations pour une migration réussie ?
            </p>
            <div className="flex items-center gap-3 mt-4">
              <Button size="sm" variant="outline" className="h-7">
                <ThumbsUp className="h-3 w-3 mr-1" />
                8
              </Button>
              <Button size="sm" variant="outline" className="h-7">
                <Reply className="h-3 w-3 mr-1" />
                Répondre
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Replies */}
      <AnimatePresence>
        {showReplies && (
          <div className="space-y-2 pl-6 border-l-2 border-border">
            {replies.map((reply, index) => (
              <motion.div
                key={`reply-${reply.author}-${index}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.15 }}
              >
                <Card className={reply.isBestAnswer ? 'border-green-500/50 bg-green-500/5' : ''}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{reply.author.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{reply.author}</span>
                          {reply.isBestAnswer && (
                            <Badge variant="outline" className="text-[10px] gap-1 text-green-600 border-green-200">
                              <Award className="h-2.5 w-2.5" />
                              Meilleure réponse
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">{reply.time}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{reply.content}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Button size="sm" variant="ghost" className="h-6 text-xs">
                            <ThumbsUp className="h-3 w-3 mr-1" />
                            {reply.likes}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  )
})
ForumPostDetailPreview.displayName = 'ForumPostDetailPreview'

// ============================================
// FORUM STATS PREVIEW
// ============================================

export const ForumStatsPreview = memo(() => {
  const stats = [
    { label: 'Sujets', value: 156, icon: MessageSquare, trend: '+12 ce mois' },
    { label: 'Membres actifs', value: 47, icon: Users, trend: '+5 ce mois' },
    { label: 'Réponses', value: 892, icon: Reply, trend: '+45 cette semaine' },
    { label: 'Résolutions', value: 134, icon: CheckCircle2, trend: '86% de taux' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((stat, index) => {
        const Icon = stat.icon
        return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Icon className="h-4 w-4" />
                  <span className="text-xs">{stat.label}</span>
                </div>
                <div className="text-xl font-bold">
                  <TutorielCountUpAnimation value={stat.value} delay={index * 100} duration={1000} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{stat.trend}</p>
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
})
ForumStatsPreview.displayName = 'ForumStatsPreview'
