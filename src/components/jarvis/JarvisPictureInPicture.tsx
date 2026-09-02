 /**
  * JARVIS V12.0 - Picture-in-Picture Widget
  * 
  * Mini-widget Jarvis flottant qui reste visible pendant la navigation
  */
 
 import React, { useState, useCallback, useRef, useEffect } from 'react';
 import { debug } from '@/lib/debug';
 import { motion, AnimatePresence, useDragControls, PanInfo } from 'framer-motion';
 import { MessageCircle, X, Minimize2, Maximize2, Send, Sparkles } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { cn } from '@/lib/utils';
 import { invokeEdge } from "@/services/edgeFunctions";
 interface Position {
   x: number;
   y: number;
 }
 
 interface JarvisPictureInPictureProps {
   isOpen: boolean;
   onClose: () => void;
   onExpand: () => void;
   defaultPosition?: Position;
 }
 
 export function JarvisPictureInPicture({
   isOpen,
   onClose,
   onExpand,
   defaultPosition = { x: window.innerWidth - 380, y: window.innerHeight - 450 }
 }: JarvisPictureInPictureProps) {
   const [position, setPosition] = useState<Position>(defaultPosition);
   const [isMinimized, setIsMinimized] = useState(false);
   const [inputValue, setInputValue] = useState('');
   const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
   const [isLoading, setIsLoading] = useState(false);
   const [streamingContent, setStreamingContent] = useState('');
   
   const dragControls = useDragControls();
   const constraintsRef = useRef<HTMLDivElement>(null);
   const inputRef = useRef<HTMLInputElement>(null);
 
   // Constrain position to viewport
   useEffect(() => {
     const handleResize = () => {
       setPosition(prev => ({
         x: Math.min(prev.x, window.innerWidth - 340),
         y: Math.min(prev.y, window.innerHeight - (isMinimized ? 60 : 400))
       }));
     };
     
     window.addEventListener('resize', handleResize);
     return () => window.removeEventListener('resize', handleResize);
   }, [isMinimized]);
 
   // Simple message sending via jarvis-brain
   const sendMessage = useCallback(async (message: string): Promise<string | null> => {
     setIsLoading(true);
     setStreamingContent('');
     
     try {
       const data = await invokeEdge<any>('jarvis-brain', { 
           query: message,
           context: { source: 'pip_widget' }
         });
       return data?.response || data?.message || 'Réponse reçue';
     } catch (error) {
       debug.error('PiP message error:', error);
       return null;
     } finally {
       setIsLoading(false);
     }
   }, []);
 
   const handleDragEnd = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
     setPosition(prev => ({
       x: Math.max(0, Math.min(prev.x + info.offset.x, window.innerWidth - 340)),
       y: Math.max(0, Math.min(prev.y + info.offset.y, window.innerHeight - (isMinimized ? 60 : 400)))
     }));
   }, [isMinimized]);
 
   const handleSend = useCallback(async () => {
     if (!inputValue.trim() || isLoading) return;
     
     const userMessage = inputValue.trim();
     setInputValue('');
     setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
     
     try {
       const response = await sendMessage(userMessage);
       if (response) {
         setMessages(prev => [...prev, { role: 'assistant', content: response }]);
       }
     } catch (error) {
       debug.error('PiP send error:', error);
     }
   }, [inputValue, isLoading, sendMessage]);
 
   const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
     if (e.key === 'Enter' && !e.shiftKey) {
       e.preventDefault();
       handleSend();
     }
   }, [handleSend]);
 
   return (
     <>
       {/* Invisible constraint container */}
       <div 
         ref={constraintsRef}
         className="fixed inset-0 pointer-events-none"
         style={{ zIndex: 9998 }}
       />
       
       <AnimatePresence>
         {isOpen && (
           <motion.div
             initial={{ opacity: 0, scale: 0.8 }}
             animate={{ opacity: 1, scale: 1 }}
             exit={{ opacity: 0, scale: 0.8 }}
             drag
             dragControls={dragControls}
             dragMomentum={false}
             dragElastic={0}
             onDragEnd={handleDragEnd}
             style={{
               position: 'fixed',
               left: position.x,
               top: position.y,
               zIndex: 9999,
             }}
             className={cn(
               "bg-background/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl",
               "overflow-hidden transition-all duration-300",
               isMinimized ? "w-[200px]" : "w-[340px]"
             )}
           >
             {/* Header - Draggable area */}
             <div 
               className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-primary/20 to-primary/5 cursor-move border-b border-border/50"
               onPointerDown={(e) => dragControls.start(e)}
             >
               <div className="flex items-center gap-2">
                 <motion.div
                   animate={{ 
                     rotate: isLoading ? 360 : 0,
                     scale: isLoading ? [1, 1.1, 1] : 1
                   }}
                   transition={{ 
                     rotate: { duration: 2, repeat: isLoading ? Infinity : 0, ease: "linear" },
                     scale: { duration: 0.5, repeat: isLoading ? Infinity : 0 }
                   }}
                   className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center"
                 >
                   <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
                 </motion.div>
                 <span className="text-sm font-medium text-foreground">Jarvis</span>
               </div>
               
               <div className="flex items-center gap-1">
                 <Button
                   variant="ghost"
                   size="icon"
                   className="h-6 w-6"
                   onClick={() => setIsMinimized(!isMinimized)} aria-label="Agrandir">
                   {isMinimized ? (
                     <Maximize2 className="h-3.5 w-3.5" />
                   ) : (
                     <Minimize2 className="h-3.5 w-3.5" />
                   )}
                 </Button>
                 <Button
                   variant="ghost"
                   size="icon"
                   className="h-6 w-6"
                   onClick={onExpand}
                   title="Ouvrir en grand" aria-label="Message">
                   <MessageCircle className="h-3.5 w-3.5" />
                 </Button>
                 <Button
                   variant="ghost"
                   size="icon"
                   className="h-6 w-6"
                   onClick={onClose} aria-label="Fermer">
                   <X className="h-3.5 w-3.5" />
                 </Button>
               </div>
             </div>
 
             {/* Content */}
             <AnimatePresence>
               {!isMinimized && (
                 <motion.div
                   initial={{ height: 0, opacity: 0 }}
                   animate={{ height: 'auto', opacity: 1 }}
                   exit={{ height: 0, opacity: 0 }}
                   className="flex flex-col"
                 >
                   {/* Messages area */}
                   <div className="h-[280px] overflow-y-auto p-3 space-y-3">
                     {messages.length === 0 ? (
                       <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                         <Sparkles className="h-8 w-8 mb-2 opacity-50" />
                         <p className="text-sm">Comment puis-je vous aider ?</p>
                       </div>
                     ) : (
                       messages.map((msg, i) => (
                         <motion.div
                           key={`jarvis-pip-message-${msg.role}-${i}`}
                           initial={{ opacity: 0, y: 10 }}
                           animate={{ opacity: 1, y: 0 }}
                           className={cn(
                             "max-w-[90%] p-2.5 rounded-xl text-sm",
                             msg.role === 'user' 
                               ? "ml-auto bg-primary text-primary-foreground" 
                               : "bg-muted"
                           )}
                         >
                           {msg.content}
                         </motion.div>
                       ))
                     )}
                     
                     {/* Streaming content */}
                     {streamingContent && (
                       <motion.div
                         initial={{ opacity: 0 }}
                         animate={{ opacity: 1 }}
                         className="max-w-[90%] p-2.5 rounded-xl text-sm bg-muted"
                       >
                         {streamingContent}
                         <span className="animate-pulse">▊</span>
                       </motion.div>
                     )}
                     
                     {/* Loading indicator */}
                     {isLoading && !streamingContent && (
                       <div className="flex items-center gap-2 text-muted-foreground text-sm">
                         <motion.div
                           animate={{ opacity: [0.5, 1, 0.5] }}
                           transition={{ duration: 1.5, repeat: Infinity }}
                           className="flex gap-1"
                         >
                           <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                           <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                           <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                         </motion.div>
                         <span>Réflexion...</span>
                       </div>
                     )}
                   </div>
 
                   {/* Input area */}
                   <div className="p-2 border-t border-border/50">
                     <div className="flex items-center gap-2">
                       <Input
                         ref={inputRef}
                         value={inputValue}
                         onChange={(e) => setInputValue(e.target.value)}
                         onKeyDown={handleKeyDown}
                         placeholder="Message rapide..."
                         className="flex-1 h-9 text-sm bg-muted/50 border-0"
                         disabled={isLoading}
                       />
                       <Button
                         size="icon"
                         className="h-9 w-9 shrink-0"
                         onClick={handleSend}
                         disabled={!inputValue.trim() || isLoading} aria-label="Envoyer">
                         <Send className="h-4 w-4" />
                       </Button>
                     </div>
                   </div>
                 </motion.div>
               )}
             </AnimatePresence>
           </motion.div>
         )}
       </AnimatePresence>
     </>
   );
 }
 
 /**
  * Hook pour gérer l'état du Picture-in-Picture
  */
 export function useJarvisPiP() {
   const [isOpen, setIsOpen] = useState(false);
   const [position, setPosition] = useState({ x: 0, y: 0 });
 
   const open = useCallback((pos?: Position) => {
     if (pos) setPosition(pos);
     setIsOpen(true);
   }, []);
 
   const close = useCallback(() => {
     setIsOpen(false);
   }, []);
 
   const toggle = useCallback(() => {
     setIsOpen(prev => !prev);
   }, []);
 
   return {
     isOpen,
     position,
     open,
     close,
     toggle,
     setPosition
   };
 }