/**
 * @deprecated This standalone hook has been merged into JarvisProactiveAlertsContext.
 * Import from '@/contexts/JarvisProactiveAlertsContext' or use the re-export
 * from '@/components/jarvis/index.ts' instead.
 * 
 * This file is kept as a pure re-export for backward compatibility.
 * It no longer opens any Realtime channel.
 */

export { useJarvisProactiveAlertsContext as useJarvisRealtimeAlerts } from '@/contexts/JarvisProactiveAlertsContext';
export { useJarvisProactiveAlertsContext as default } from '@/contexts/JarvisProactiveAlertsContext';
