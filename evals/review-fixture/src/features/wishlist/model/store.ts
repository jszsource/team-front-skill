import { create } from 'zustand';

type WishlistState = { ids: string[]; add: (id: string) => void };

export const useWishlistStore = create<WishlistState>((set) => ({
  ids: [],
  add: (id) => set((s) => ({ ids: [...s.ids, id] })),
}));
