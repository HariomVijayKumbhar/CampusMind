import { create } from 'zustand';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';

let tempIdCounter = 0;

function updateQuotaFromHeaders(set, headers) {
  const remaining = headers?.['ratelimit-remaining'];
  const limit = headers?.['ratelimit-limit'];
  const reset = headers?.['ratelimit-reset'];
  if (remaining != null && limit != null) {
    set({
      chatQuota: {
        remaining: parseInt(remaining, 10),
        limit: parseInt(limit, 10),
        reset: reset ? parseInt(reset, 10) : null,
      },
    });
  }
}

export const useChatStore = create((set, get) => ({
  messages: [],
  loadingHistory: false,
  loadingOlder: false,
  sending: false,
  error: '',
  hasMoreHistory: true,
  historyCursor: null,
  conversations: [],
  activeConversationId: null,
  chatQuota: null, // { remaining, limit, reset }

  clearError: () => set({ error: '' }),

  loadHistory: async () => {
    set({ loadingHistory: true, error: '' });
    try {
      const params = {};
      if (get().activeConversationId) params.conversation_id = get().activeConversationId;
      const response = await api.get('/api/chat/history', { params });
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
    const { historyCursor, hasMoreHistory, loadingOlder, messages, activeConversationId } = get();
    if (!hasMoreHistory || loadingOlder || !historyCursor) return;

    set({ loadingOlder: true });
    try {
      const response = await api.get('/api/chat/history', {
        params: {
          cursor: historyCursor,
          limit: 20,
          ...(activeConversationId ? { conversation_id: activeConversationId } : {}),
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

  // --- Conversations (sessions sidebar) ---

  loadConversations: async () => {
    try {
      const response = await api.get('/api/chat/conversations');
      set({ conversations: response.data?.conversations || [] });
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  },

  selectConversation: async (conversationId) => {
    if (!conversationId) {
      set({ activeConversationId: null, messages: [], hasMoreHistory: true, historyCursor: null });
      return;
    }
    set({ activeConversationId: conversationId, messages: [], historyCursor: null, hasMoreHistory: true });
    await get().loadHistory();
  },

  renameConversation: async (conversationId, title) => {
    await api.patch(`/api/chat/conversations/${conversationId}`, { title });
    await get().loadConversations();
  },

  deleteConversation: async (conversationId) => {
    await api.delete(`/api/chat/conversations/${conversationId}`);
    if (get().activeConversationId === conversationId) {
      set({ activeConversationId: null, messages: [] });
    }
    await get().loadConversations();
  },

  // --- Feedback ---

  rateMessage: async (messageId, rating) => {
    try {
      const response = await api.post('/api/feedback', {
        message_id: messageId,
        rating,
      });
      if (response.data?.success) {
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === messageId ? { ...m, myRating: rating } : m
          ),
        }));
      }
      return true;
    } catch (err) {
      console.error('Failed to save feedback:', err);
      set({ error: 'Failed to save feedback.' });
      return false;
    }
  },

  // --- Send (non-streaming fallback) ---

  sendMessage: async (content, collectionId = null) => {
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
      const response = await api.post('/api/chat', {
        message: trimmed,
        collection_id: collectionId || null,
        conversation_id: get().activeConversationId,
      });
      if (response.data?.conversation_id) set({ activeConversationId: response.data.conversation_id });
      updateQuotaFromHeaders(set, response.headers);

      const assistantMsg = {
        id: `temp-assistant-${tempIdCounter}`,
        role: 'assistant',
        content: response.data.answer || '',
        sources: Array.isArray(response.data.sources)
          ? response.data.sources
          : [],
        confidence: typeof response.data.confidence === 'number'
          ? response.data.confidence
          : null,
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
          err.response?.status === 429
            ? err.response?.data?.error || 'Too many messages, please slow down.'
            : err.response?.data?.error ||
              'Failed to get an answer. Please try again.',
      }));
    } finally {
      set({ sending: false });
    }
  },

  // --- Send (streaming, primary path) ---

  sendMessageStream: async (content, collectionId = null) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    tempIdCounter += 1;
    const uid = tempIdCounter;
    const assistantId = `stream-assistant-${uid}`;

    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: `temp-user-${uid}`,
          role: 'user',
          content: trimmed,
          sources: [],
          created_at: new Date().toISOString(),
        },
        {
          id: assistantId,
          role: 'assistant',
          content: '',
          sources: [],
          created_at: new Date().toISOString(),
          streaming: true,
        },
      ],
      sending: true,
      error: '',
    }));

    const updateAssistant = (patch) =>
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === assistantId ? { ...m, ...patch } : m
        ),
      }));

    try {
      const token = useAuthStore.getState().session?.access_token;
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/chat/stream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            message: trimmed,
            collection_id: collectionId,
            conversation_id: get().activeConversationId,
          }),
        }
      );

      if (!response.ok || !response.body) {
        if (response.status === 429) {
          let msg = 'Too many messages, please slow down.';
          try { msg = (await response.json())?.error || msg; } catch {}
          set({ error: msg });
          set((state) => ({
            messages: state.messages.filter((m) => m.id !== assistantId && m.id !== `temp-user-${uid}`),
          }));
          return;
        }
        throw new Error(`Stream failed (${response.status})`);
      }
      updateQuotaFromHeaders(set, response.headers);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const handleEvent = (event, data) => {
        if (event === 'meta') {
          updateAssistant({
            sources: Array.isArray(data.sources) ? data.sources : [],
            confidence: data.confidence ?? null,
          });
        } else if (event === 'token') {
          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + data.text } : m
            ),
          }));
        } else if (event === 'done') {
          updateAssistant({
            content: data.answer,
            sources: Array.isArray(data.sources) ? data.sources : [],
            confidence: data.confidence ?? null,
            streaming: false,
          });
        } else if (event === 'error') {
          throw new Error(data.error || 'Stream error');
        }
      };

      // Parse SSE frames manually (no EventSource so we can POST with auth)
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split('\n\n');
        buffer = frames.pop() || '';

        for (const frame of frames) {
          let event = 'message';
          let data = '';
          for (const line of frame.split('\n')) {
            if (line.startsWith('event: ')) event = line.slice(7).trim();
            else if (line.startsWith('data: ')) data += line.slice(6);
          }
          if (data) handleEvent(event, JSON.parse(data));
        }
      }

      // Mark user message as confirmed
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === `temp-user-${uid}` ? { ...m, id: `user-${uid}` } : m
        ),
      }));
    } catch (err) {
      console.error('Streaming failed, falling back:', err);
      set((state) => ({
        messages: state.messages.filter(
          (m) => m.id !== assistantId && m.id !== `temp-user-${uid}`
        ),
        sending: false,
      }));
      return get().sendMessage(content, collectionId);
    } finally {
      set({ sending: false });
      get().loadConversations();
    }
  },
}));
