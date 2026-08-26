import { create } from 'zustand';
import api from '@/services/api';

let tempIdCounter = 0;

export const useChatStore = create((set, get) => ({
  messages: [],
  loadingHistory: false,
  loadingOlder: false,
  sending: false,
  error: '',
  hasMoreHistory: true,
  historyCursor: null,

  loadHistory: async () => {
    set({ loadingHistory: true, error: '' });
    try {
      const response = await api.get('/api/chat/history');
      const messages = Array.isArray(response.data?.messages)
        ? response.data.messages
        : [];
      const normalized = messages.map((m) => ({
        ...m,
        sources: Array.isArray(m.sources) ? m.sources : [],
      }));

      set({
        messages: normalized,
        historyCursor: response.data?.pagination?.cursor || null,
        hasMoreHistory: response.data?.pagination?.hasMore || false,
      });
    } catch (err) {
      console.error('Failed to load chat history:', err);
      set({ error: 'Failed to load chat history. Please refresh the page.' });
    } finally {
      set({ loadingHistory: false });
    }
  },

  loadOlderMessages: async () => {
    const { historyCursor, hasMoreHistory, loadingOlder, messages } = get();
    if (!hasMoreHistory || loadingOlder || !historyCursor) return;

    set({ loadingOlder: true });
    try {
      const response = await api.get('/api/chat/history', {
        params: {
          cursor: historyCursor,
          limit: 20,
        },
      });

      const olderMessages = Array.isArray(response.data?.messages)
        ? response.data.messages
        : [];
      const normalized = olderMessages.map((m) => ({
        ...m,
        sources: Array.isArray(m.sources) ? m.sources : [],
      }));

      set({
        messages: [...normalized, ...messages],
        historyCursor: response.data?.pagination?.cursor || historyCursor,
        hasMoreHistory: response.data?.pagination?.hasMore || false,
      });
    } catch (err) {
      console.error('Failed to load older messages:', err);
    } finally {
      set({ loadingOlder: false });
    }
  },

  sendMessage: async (content) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    tempIdCounter += 1;
    const tempUserMsg = {
      id: `temp-user-${tempIdCounter}`,
      role: 'user',
      content: trimmed,
      sources: [],
      created_at: new Date().toISOString(),
      pending: true,
    };

    set((state) => ({
      messages: [...state.messages, tempUserMsg],
      sending: true,
      error: '',
    }));

    try {
      const response = await api.post('/api/chat', { message: trimmed });

      const assistantMsg = {
        id: `temp-assistant-${tempIdCounter}`,
        role: 'assistant',
        content: response.data.answer || '',
        sources: Array.isArray(response.data.sources)
          ? response.data.sources
          : [],
        created_at: new Date().toISOString(),
      };

      set((state) => ({
        messages: [
          ...state.messages.filter((m) => m.id !== tempUserMsg.id),
          { ...tempUserMsg, id: `user-${tempIdCounter}`, pending: false },
          assistantMsg,
        ],
      }));
    } catch (err) {
      console.error('Failed to send message:', err);
      set((state) => ({
        messages: state.messages.filter((m) => m.id !== tempUserMsg.id),
        error:
          err.response?.data?.error ||
          'Failed to get an answer. Please try again.',
      }));
    } finally {
      set({ sending: false });
    }
  },

  clearError: () => set({ error: '' }),
}));
