import * as React from 'react';

interface PortalContextValue {
  container: HTMLElement;
}

const PortalContext = React.createContext<PortalContextValue | null>(null);

export interface PortalProviderProps {
  container: HTMLElement;
  children: React.ReactNode;
}

export function PortalProvider({ container, children }: PortalProviderProps): React.ReactElement {
  const value = React.useMemo<PortalContextValue>(() => ({ container }), [container]);
  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortalContainer(): HTMLElement {
  const ctx = React.useContext(PortalContext);
  if (!ctx) {
    throw new Error(
      '[paperx] usePortalContainer must be used inside <PortalProvider>. ' +
        'src/content/index.tsx is responsible for wiring it so Radix overlays ' +
        'portal into the Shadow DOM, not document.body.',
    );
  }
  return ctx.container;
}
