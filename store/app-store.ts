import { create } from 'zustand';
import type { Child } from '@/lib/database.types';

interface AppStore {
  children: Child[];
  activeChildId: string | null;
  isChildrenLoading: boolean;

  setChildren: (children: Child[]) => void;
  addChild: (child: Child) => void;
  patchChild: (id: string, updates: Partial<Child>) => void;
  setActiveChildId: (id: string) => void;
  setIsChildrenLoading: (loading: boolean) => void;
  activeChild: () => Child | null;
  reset: () => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  children: [],
  activeChildId: null,
  isChildrenLoading: true,

  setChildren: (children) => {
    const state = get();
    const activeStillExists = children.some((c) => c.id === state.activeChildId);
    set({
      children,
      activeChildId: activeStillExists
        ? state.activeChildId
        : (children[0]?.id ?? null),
    });
  },

  addChild: (child) => {
    const { children } = get();
    set({
      children: [...children, child],
      activeChildId: get().activeChildId ?? child.id,
    });
  },

  patchChild: (id, updates) => {
    set({
      children: get().children.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    });
  },

  setActiveChildId: (id) => set({ activeChildId: id }),

  setIsChildrenLoading: (loading) => set({ isChildrenLoading: loading }),

  activeChild: () => {
    const { children, activeChildId } = get();
    return children.find((c) => c.id === activeChildId) ?? null;
  },

  reset: () => set({ children: [], activeChildId: null, isChildrenLoading: true }),
}));
