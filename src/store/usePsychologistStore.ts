import { create } from 'zustand';
import { Psychologist } from '../models/Psychologist';
import { getAvailablePsychologists } from '../repositories/PsychologistRepository';

interface PsychologistState {
  psychologists: Psychologist[];
  selectedPsychologist: Psychologist | null;
  isLoading: boolean;
  error: string | null;

  fetchAvailablePsychologists: () => Promise<void>;
  selectPsychologist: (p: Psychologist | null) => void;
  clearError: () => void;
}

export const usePsychologistStore = create<PsychologistState>((set) => ({
  psychologists: [],
  selectedPsychologist: null,
  isLoading: false,
  error: null,

  fetchAvailablePsychologists: async () => {
    set({ isLoading: true, error: null });
    try {
      const list = await getAvailablePsychologists();
      set({ psychologists: list, isLoading: false });
    } catch (error) {
      set({ error: `${error}`, isLoading: false });
    }
  },

  selectPsychologist: (p) => set({ selectedPsychologist: p }),
  clearError: () => set({ error: null }),
}));
