import { onCLS, onFCP, onLCP, onTTFB, onINP } from 'web-vitals';
import { pwaAnalytics } from './pwa-analytics';
import { debug } from '@/lib/debug';
import { isThirdPartyIframe } from './iframeDetection';

export interface WebVitalsMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: WebVitalsMetric[] = [];

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  init(): void {
    // Skip dans les iframes tierces
    if (isThirdPartyIframe()) {
      if (import.meta.env.DEV) {
        console.info('[Performance] Disabled in third-party iframe');
      }
      return;
    }
    
    if (import.meta.env.DEV) {
      debug.log('🚀 Performance monitoring initialized');
    }

    // Collecte des Core Web Vitals
    onCLS(this.handleMetric);
    onINP(this.handleMetric); // INP remplace FID dans web-vitals v4
    onFCP(this.handleMetric);
    onLCP(this.handleMetric);
    onTTFB(this.handleMetric);
  }

  private handleMetric = (metric: WebVitalsMetric): void => {
    this.metrics.push(metric);
    
    if (import.meta.env.MODE === 'development') {
      debug.log(`📊 ${metric.name}:`, {
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta
      });
    }

    // Alertes pour les métriques critiques - only in dev to avoid console noise
    if (metric.rating === 'poor' && import.meta.env.DEV) {
      debug.warn(`⚠️ Poor ${metric.name}: ${metric.value}ms`);
    }

    // Envoyer vers PWA Analytics pour le tracking mobile
    pwaAnalytics.trackPWAPerformance({
      [metric.name]: metric.value,
      rating: metric.rating === 'good' ? 1 : metric.rating === 'needs-improvement' ? 0.5 : 0
    });
  };


  getMetrics(): WebVitalsMetric[] {
    return this.metrics;
  }

  // Collecte un rapport de performance
  getPerformanceReport(): {
    metrics: WebVitalsMetric[];
    summary: {
      good: number;
      needsImprovement: number;
      poor: number;
    };
  } {
    const summary = this.metrics.reduce(
      (acc, metric) => {
        acc[metric.rating === 'good' ? 'good' : metric.rating === 'needs-improvement' ? 'needsImprovement' : 'poor']++;
        return acc;
      },
      { good: 0, needsImprovement: 0, poor: 0 }
    );

    return {
      metrics: this.metrics,
      summary
    };
  }
}

// Instance globale
export const performanceMonitor = PerformanceMonitor.getInstance();