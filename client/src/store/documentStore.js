import { create } from 'zustand';
import api from '@/services/api';

const POLL_INTERVAL = 3000;
const MAX_POLL_ATTEMPTS = 40;

export const useDocumentStore = create((set, get) => ({
  documents: [],
  loading: false,
  uploading: false,
  pollingDocuments: {},
  error: '',
  success: '',

  fetchDocuments: async () => {
    try {
      set({ loading: true, error: '' });
      const response = await api.get('/api/documents');
      set({ documents: response.data.documents || [] });
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to load documents' });
    } finally {
      set({ loading: false });
    }
  },

  uploadDocument: async (file) => {
    set({ error: '', success: '', uploading: true });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/api/documents', formData);
      const document = response.data.document;

      set({
        success: `${file.name} uploaded successfully (${document.chunk_count || 0} chunks)`,
        uploading: false,
      });

      if (document.status === 'processing') {
        get().startPolling(document.id);
      }

      await get().fetchDocuments();

      return document;
    } catch (err) {
      set({
        error: err.response?.data?.error || 'Upload failed',
        uploading: false,
      });
      throw err;
    }
  },

  startPolling: (documentId) => {
    if (get().pollingDocuments[documentId]) return;

    set((state) => ({
      pollingDocuments: {
        ...state.pollingDocuments,
        [documentId]: { attempts: 0, intervalId: null },
      },
    }));

    const intervalId = setInterval(async () => {
      const state = get();
      const pollingDoc = state.pollingDocuments[documentId];

      if (!pollingDoc || pollingDoc.attempts >= MAX_POLL_ATTEMPTS) {
        clearInterval(intervalId);
        set((s) => {
          const newPolling = { ...s.pollingDocuments };
          delete newPolling[documentId];
          return { pollingDocuments: newPolling };
        });
        return;
      }

      try {
        const response = await api.get(`/api/documents/${documentId}`);
        const document = response.data.document;

        set((state) => {
          const docs = state.documents.map((d) =>
            d.id === documentId ? document : d
          );
          return { documents: docs };
        });

        if (document.status === 'ready') {
          clearInterval(intervalId);
          set((s) => {
            const newPolling = { ...s.pollingDocuments };
            delete newPolling[documentId];
            return {
              success: `${document.title} processed successfully (${document.chunk_count} chunks)`,
              pollingDocuments: newPolling,
            };
          });
        } else if (document.status === 'failed') {
          clearInterval(intervalId);
          set((s) => {
            const newPolling = { ...s.pollingDocuments };
            delete newPolling[documentId];
            return {
              error: `${document.title} processing failed`,
              pollingDocuments: newPolling,
            };
          });
        } else {
          set((s) => ({
            pollingDocuments: {
              ...s.pollingDocuments,
              [documentId]: {
                ...s.pollingDocuments[documentId],
                attempts: s.pollingDocuments[documentId].attempts + 1,
              },
            },
          }));
        }
      } catch (err) {
        console.error(`Polling error for document ${documentId}:`, err);
      }
    }, POLL_INTERVAL);

    set((state) => ({
      pollingDocuments: {
        ...state.pollingDocuments,
        [documentId]: {
          ...state.pollingDocuments[documentId],
          intervalId,
        },
      },
    }));
  },

  stopPolling: (documentId) => {
    const state = get();
    const pollingDoc = state.pollingDocuments[documentId];

    if (pollingDoc?.intervalId) {
      clearInterval(pollingDoc.intervalId);
    }

    set((s) => {
      const newPolling = { ...s.pollingDocuments };
      delete newPolling[documentId];
      return { pollingDocuments: newPolling };
    });
  },

  deleteDocument: async (id) => {
    if (!confirm('Are you sure you want to delete this document? Its chunks will also be removed.')) {
      return;
    }

    try {
      get().stopPolling(id);
      await api.delete(`/api/documents/${id}`);
      set({ success: 'Document deleted' });
      await get().fetchDocuments();
    } catch (err) {
      set({ error: err.response?.data?.error || 'Delete failed' });
    }
  },

  clearError: () => set({ error: '' }),
  clearSuccess: () => set({ success: '' }),
}));
