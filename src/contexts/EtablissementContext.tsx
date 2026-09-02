import React, { createContext, useContext, ReactNode } from 'react';
import { EtablissementPublic } from '@/hooks/crm/useEtablissementBySlug';

interface EtablissementContextType {
  etablissement: EtablissementPublic | null;
}

const EtablissementContext = createContext<EtablissementContextType | undefined>(undefined);

export function EtablissementProvider({ 
  children, 
  etablissement 
}: { 
  children: ReactNode; 
  etablissement: EtablissementPublic | null;
}) {
  return (
    <EtablissementContext.Provider value={{ etablissement }}>
      {children}
    </EtablissementContext.Provider>
  );
}

export function useEtablissementContext() {
  const context = useContext(EtablissementContext);
  if (context === undefined) {
    throw new Error('useEtablissementContext must be used within EtablissementProvider');
  }
  return context;
}
