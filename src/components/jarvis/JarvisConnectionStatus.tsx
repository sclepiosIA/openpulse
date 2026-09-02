/**
 * JarvisConnectionStatus - Compact connection status indicator
 * 
 * Shows:
 * - Connection status (connected, unstable, disconnected)
 * - Offline queue count
 * - Quick health info on hover
 */

import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, AlertTriangle, Cloud, CloudOff } from 'lucide-react';
import { useJarvisCircuitState } from '@/hooks/jarvis/useJarvisCircuitState';
import { useJarvisOfflineQueue } from '@/hooks/jarvis/useJarvisOfflineQueue';
import { cn } from '@/lib/utils';

interface JarvisConnectionStatusProps {
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function JarvisConnectionStatus({ 
  showLabel = false, 
  size = 'md',
  className 
}: JarvisConnectionStatusProps) {
  const { status, degradationMode, isChecking } = useJarvisCircuitState();
  const { pendingCount, isOffline } = useJarvisOfflineQueue();

  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const getStatusIcon = () => {
    if (isOffline) {
      return <WifiOff className={cn(sizeClasses[size], 'text-red-500')} />;
    }
    
    switch (status) {
      case 'HEALTHY':
        return <Wifi className={cn(sizeClasses[size], 'text-green-500')} />;
      case 'DEGRADED':
        return <AlertTriangle className={cn(sizeClasses[size], 'text-yellow-500')} />;
      case 'UNHEALTHY':
        return <AlertTriangle className={cn(sizeClasses[size], 'text-orange-500')} />;
      case 'OFFLINE':
        return <CloudOff className={cn(sizeClasses[size], 'text-red-500')} />;
      default:
        return <Cloud className={cn(sizeClasses[size], 'text-muted-foreground', isChecking && 'animate-pulse')} />;
    }
  };

  const getStatusColor = () => {
    if (isOffline) return 'bg-red-500';
    switch (status) {
      case 'HEALTHY': return 'bg-green-500';
      case 'DEGRADED': return 'bg-yellow-500';
      case 'UNHEALTHY': return 'bg-orange-500';
      case 'OFFLINE': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusLabel = () => {
    if (isOffline) return 'Hors ligne';
    switch (status) {
      case 'HEALTHY': return 'Connecté';
      case 'DEGRADED': return 'Instable';
      case 'UNHEALTHY': return 'Dégradé';
      case 'OFFLINE': return 'Déconnecté';
      default: return 'Vérification...';
    }
  };

  const getTooltipContent = () => {
    const lines = [];
    
    if (isOffline) {
      lines.push('Vous êtes hors ligne');
    } else {
      lines.push(`État: ${getStatusLabel()}`);
      lines.push(`Mode: ${degradationMode}`);
    }
    
    if (pendingCount > 0) {
      lines.push(`${pendingCount} message(s) en attente`);
    }
    
    return lines;
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn('flex items-center gap-1.5 cursor-default', className)}>
          {/* Pulsing dot indicator */}
          <div className="relative">
            <span className={cn(
              'block rounded-full',
              size === 'sm' ? 'h-2 w-2' : size === 'md' ? 'h-2.5 w-2.5' : 'h-3 w-3',
              getStatusColor()
            )} />
            {(status === 'HEALTHY' && !isOffline) && (
              <span className={cn(
                'absolute inset-0 rounded-full animate-ping opacity-75',
                getStatusColor()
              )} />
            )}
          </div>
          
          {/* Icon */}
          {getStatusIcon()}
          
          {/* Label */}
          {showLabel && (
            <span className="text-xs text-muted-foreground">
              {getStatusLabel()}
            </span>
          )}
          
          {/* Pending queue badge */}
          {pendingCount > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
              {pendingCount}
            </Badge>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        <div className="space-y-0.5">
          {getTooltipContent().map((line, i) => (
            <p key={`connection-status-line-${i}-${line.slice(0, 16)}`}>{line}</p>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export default JarvisConnectionStatus;
