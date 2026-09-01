import { create } from 'zustand';
import api from '@/services/api';

const POLL_INTERVAL = 3000;
const MAX_POLL_ATTEMPTS = 60;

export const useDocumentStore = create((set, get) => ({
  documents: [],
  collections: [],
  loading: false,
  uploading: false,
  error: '',
  success: '',
  processingDocuments: {},

  fetchCollections: async () => {
    try {
      const response = await api.get('/api/collections');
      set({ collections: response.data.collections || [] });
      return response.data.collections || [];
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to load collections' });
      return [];
    }
  },

  fetchDocuments: async (collectionId = null) => {
    try {
      set({ loading: true, error: '' });
      const params = collectionId ? { collection_id: collectionId } : {};
      const response = await api.get('/api/documents', { params });
      set({ documents: response.data.documents || [] });
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to load documents' });
    } finally {
      set({ loading: false });
    }
  },

  /**
   * Upload a document via the async pipeline.
   * Backend returns 202 Accepted — file extraction/chunking/embedding
   * happens in a BullMQ background worker.
   * This method immediately starts a polling loop that checks document
   * status until it becomes 'ready' or 'failed', then updates the UI.
   */
  uploadDocument: async (file, collectionId = null) => {
    set({ error: '', success: '', uploading: true });

    const formData = new FormData();
    formData.append('file', file);
    if (collectionId) {
      formData.append('collection_id', collectionId);
    }

    try {
      const response = await api.post('/api/documents', formData);
      const document = response.data.document;

      set({
        success: `${file.name} uploaded. Processing in background...`,
        uploading: false,
      });

      get().startPolling(document.id);
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

  /**
   * Poll GET /api/documents/:id every POLL_INTERVAL seconds until the
   * document status is 'ready' or 'failed', or MAX_POLL_ATTEMPTS is reached.
   */
  startPolling: (documentId) => {
    if (get().processingDocuments[documentId]) return;

    set((state) => ({
      processingDocuments: {
        ...state.processingDocuments,
        [documentId]: { attempts: 0 },
      },
    }));

    const intervalId = setInterval(async () => {
      const current = get().processingDocuments[documentId];
      if (!current || current.attempts >= MAX_POLL_ATTEMPTS) {
        clearInterval(intervalId);
        set((s) => {
          const next = { ...s.processingDocuments };
          delete next[documentId];
          return { processingDocuments: next };
        });
        return;
      }

      try {
        const response = await api.get(`/api/documents/${documentId}`);
        const doc = response.data.document;

        // Optimistically update the document in the list
        set((state) => ({
          documents: state.documents.map((d) =>
            d.id === documentId ? { ...d, ...doc } : d
          ),
        }));

        if (doc.status === 'ready') {
          clearInterval(intervalId);
          set((s) => {
            const next = { ...s.processingDocuments };
            delete next[documentId];
            return {
              processingDocuments: next,
              success: `${doc.title} processed successfully (${doc.chunk_count} chunks)`,
            };
          });
        } else if (doc.status === 'failed') {
          clearInterval(intervalId);
          set((s) => {
            const next = { ...s.processingDocuments };
            delete next[documentId];
            return {
              processingDocuments: next,
              error: `${doc.title} processing failed. Please try a different file or contact support.`,
            };
          });
        } else {
          set((s) => ({
            processingDocuments: {
              ...s.processingDocuments,
              [documentId]: { attempts: s.processingDocuments[documentId].attempts + 1 },
            },
          }));
        }
      } catch (err) {
        set((s) => ({
          processingDocuments: {
            ...s.processingDocuments,
            [documentId]: { attempts: s.processingDocuments[documentId].attempts + 1 },
          },
        }));
      }
    }, POLL_INTERVAL);

    set((state) => ({
      processingDocuments: {
        ...state.processingDocuments,
        [documentId]: { ...state.processingDocuments[documentId], intervalId },
      },
    }));
  },

  stopPolling: (documentId) => {
    const pollingDoc = get().processingDocuments[documentId];
    if (pollingDoc?.intervalId) {
      clearInterval(pollingDoc.intervalId);
    }
    set((state) => {
      const next = { ...state.processingDocuments };
      delete next[documentId];
      return { processingDocuments: next };
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
