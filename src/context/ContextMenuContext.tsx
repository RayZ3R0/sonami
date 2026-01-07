import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { ContextMenu, ContextMenuItem } from "../components/ContextMenu";

interface ContextMenuContextType {
  showMenu: (
    items: ContextMenuItem[],
    position: { x: number; y: number },
  ) => void;
  hideMenu: () => void;
}

const ContextMenuContext = createContext<ContextMenuContextType | null>(null);

export const useContextMenu = () => {
  const context = useContext(ContextMenuContext);
  if (!context) {
    throw new Error("useContextMenu must be used within a ContextMenuProvider");
  }
  return context;
};

export const ContextMenuProvider = ({ children }: { children: ReactNode }) => {
  const [menu, setMenu] = useState<{
    items: ContextMenuItem[];
    position: { x: number; y: number };
  } | null>(null);

  const showMenu = useCallback(
    (items: ContextMenuItem[], position: { x: number; y: number }) => {
      setMenu({ items, position });
    },
    [],
  );

  const hideMenu = useCallback(() => {
    setMenu(null);
  }, []);

  return (
    <ContextMenuContext.Provider value={{ showMenu, hideMenu }}>
      {children}
      {menu && (
        <ContextMenu
          items={menu.items}
          position={menu.position}
          onClose={hideMenu}
        />
      )}
    </ContextMenuContext.Provider>
  );
};
