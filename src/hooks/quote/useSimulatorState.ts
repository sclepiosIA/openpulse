import { useState, useCallback } from 'react';
import type { SimulationParams, QuoteConfiguration, AnalyticsParams, SimulatorTab } from '@/types/simulator';
import { DEFAULT_SIMULATION_PARAMS, CENTER_TYPES, DPI_TYPES } from '@/lib/simulator-config';
import { useSimulationCalculator } from './useSimulationCalculator';
import { useQuoteCalculator } from './useQuoteCalculator';
import { useAnalyticsCalculator } from '../analytics/useAnalyticsCalculator';

interface UseSimulatorStateProps {
  initialPassages?: number;
  initialBaseline?: number;
  initialDPIType?: string;
  initialCenterType?: string;
}

/**
 * Hook central de gestion de l'état du simulateur
 */
export function useSimulatorState(props: UseSimulatorStateProps = {}) {
  const { initialPassages, initialBaseline, initialDPIType, initialCenterType } = props;

  // État de l'onglet actif
  const [activeTab, setActiveTab] = useState<SimulatorTab>('simulation');

  // Paramètres de simulation
  const [params, setParams] = useState<SimulationParams>(() => ({
    ...DEFAULT_SIMULATION_PARAMS,
    ...(initialPassages && { passages: initialPassages }),
    ...(initialBaseline && { baseline: initialBaseline }),
  }));

  // Configuration du devis
  const [configuration, setConfiguration] = useState<QuoteConfiguration | null>(() => {
    const centerType = CENTER_TYPES.find(ct => ct.id === initialCenterType) || CENTER_TYPES[0];
    const dpiType = DPI_TYPES.find(dt => dt.id === initialDPIType) || DPI_TYPES[0];
    return { centerType, dpiType, resellerType: null, valorisationLevel: 'second' as const };
  });

  // Paramètres analytics
  const [analyticsParams, setAnalyticsParams] = useState<AnalyticsParams>({
    uhcdMois: 200,
    consultMois: 3000,
    plusMois: 50,
    totalProj: 40000,
  });

  // Résultats calculés
  const simulationResults = useSimulationCalculator(params);
  const quoteResults = useQuoteCalculator({ params, configuration });
  const analyticsResults = useAnalyticsCalculator({ params, analyticsParams });

  // Mise à jour d'un paramètre de simulation
  const updateParam = useCallback(<K extends keyof SimulationParams>(
    key: K,
    value: SimulationParams[K]
  ) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, []);

  // Mise à jour de plusieurs paramètres
  const updateParams = useCallback((updates: Partial<SimulationParams>) => {
    setParams(prev => ({ ...prev, ...updates }));
  }, []);

  // Réinitialiser aux valeurs par défaut
  const resetParams = useCallback(() => {
    setParams(DEFAULT_SIMULATION_PARAMS);
  }, []);

  // Mise à jour de la configuration du devis
  const updateConfiguration = useCallback((updates: Partial<QuoteConfiguration>) => {
    setConfiguration(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  // Mise à jour des paramètres analytics
  const updateAnalyticsParam = useCallback(<K extends keyof AnalyticsParams>(
    key: K,
    value: AnalyticsParams[K]
  ) => {
    setAnalyticsParams(prev => ({ ...prev, [key]: value }));
  }, []);

  return {
    // État
    activeTab,
    setActiveTab,
    params,
    configuration,
    analyticsParams,
    
    // Résultats
    simulationResults,
    quoteResults,
    analyticsResults,
    
    // Actions
    updateParam,
    updateParams,
    resetParams,
    updateConfiguration,
    updateAnalyticsParam,
  };
}
