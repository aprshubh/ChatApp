import { create } from 'zustand';
import { storage } from '../services/storageService';

export const useUIStore = create((set, get) => ({
  themeMode: 'dark', // Default dark
  activeModal: null,
  drafts: {}, // { [conversationId]: string }

  initTheme: async () => {
    try {
      const saved = await storage.getTheme();
      if (saved) {
        set({ themeMode: saved });
      }
    } catch (e) {}
  },

  setThemeMode: async (mode) => {
    set({ themeMode: mode });
    await storage.saveTheme(mode);
  },

  toggleTheme: async () => {
    const next = get().themeMode === 'dark' ? 'light' : 'dark';
    set({ themeMode: next });
    await storage.saveTheme(next);
  },

  openModal: (modalName) => set({ activeModal: modalName }),
  closeModal: () => set({ activeModal: null }),

  setDraft: (conversationId, text) =>
    set((state) => ({
      drafts: { ...state.drafts, [conversationId]: text },
    })),

  clearDraft: (conversationId) =>
    set((state) => {
      const next = { ...state.drafts };
      delete next[conversationId];
      return { drafts: next };
    }),
}));
