import { create } from 'zustand';
import api from '@/services/api';

export const useStudyStore = create((set, get) => ({
  progress: null,
  recommendations: null,
  dueFlashcards: [],
  saving: false,
  error: '',

  fetchProgress: async () => {
    try {
      const res = await api.get('/api/study/progress');
      set({ progress: res.data?.progress || null });
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to load progress' });
    }
  },

  fetchRecommendations: async () => {
    try {
      const res = await api.get('/api/study/recommendations');
      set({ recommendations: res.data?.recommendations || null });
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to load recommendations' });
    }
  },

  fetchDueFlashcards: async () => {
    try {
      const res = await api.get('/api/study/flashcards/due', { params: { due: true } });
      set({ dueFlashcards: res.data?.flashcards || [] });
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to load flashcards' });
    }
  },

  saveFlashcard: async ({ question, answer, topic }) => {
    set({ saving: true, error: '' });
    try {
      const res = await api.post('/api/study/flashcards/save', { question, answer, topic });
      set({ saving: false });
      return res.data?.flashcard || null;
    } catch (err) {
      set({ saving: false, error: err.response?.data?.error || 'Failed to save flashcard' });
      return null;
    }
  },

  reviewFlashcard: async (id, quality) => {
    try {
      await api.post(`/api/study/flashcards/${id}/review`, { quality });
      // Refresh due list
      await get().fetchDueFlashcards();
      return true;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to review flashcard' });
      return false;
    }
  },

  deleteFlashcard: async (id) => {
    try {
      await api.delete(`/api/study/flashcards/${id}`);
      set((state) => ({ dueFlashcards: state.dueFlashcards.filter((f) => f.id !== id) }));
      return true;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to delete flashcard' });
      return false;
    }
  },

  clearError: () => set({ error: '' }),
}));
