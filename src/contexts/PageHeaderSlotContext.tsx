import { createContext, useContext, useState, ReactNode } from 'react';

interface PageHeaderSlotContextType {
  headerContent: ReactNode | null;
  setHeaderContent: (content: ReactNode | null) => void;
}

const PageHeaderSlotContext = createContext<PageHeaderSlotContextType>({
  headerContent: null,
  setHeaderContent: () => {},
});

export const usePageHeaderSlot = () => useContext(PageHeaderSlotContext);

export function PageHeaderSlotProvider({ children }: { children: ReactNode }) {
  const [headerContent, setHeaderContent] = useState<ReactNode | null>(null);
  return (
    <PageHeaderSlotContext.Provider value={{ headerContent, setHeaderContent }}>
      {children}
    </PageHeaderSlotContext.Provider>
  );
}
