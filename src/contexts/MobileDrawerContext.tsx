import { createContext, useContext, useState, ReactNode } from 'react';

interface MobileDrawerContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setOpen: (open: boolean) => void;
}

const MobileDrawerContext = createContext<MobileDrawerContextType>({
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
  setOpen: () => {},
});

export const useMobileDrawer = () => useContext(MobileDrawerContext);

export function MobileDrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const toggle = () => setIsOpen(prev => !prev);
  const setOpen = (open: boolean) => setIsOpen(open);

  return (
    <MobileDrawerContext.Provider value={{ isOpen, open, close, toggle, setOpen }}>
      {children}
    </MobileDrawerContext.Provider>
  );
}
