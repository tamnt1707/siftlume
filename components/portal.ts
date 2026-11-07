import { createContext, useContext } from 'react';

/**
 * The themed root element. Radix portals into document.body by default, which is outside the
 * element carrying the Inkmark CSS variables; menus portal here instead so they keep the theme.
 */
export const PortalContainerContext = createContext<HTMLElement | null>(null);
export const usePortalContainer = () => useContext(PortalContainerContext) ?? undefined;
