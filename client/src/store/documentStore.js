import { create } from 'zustand';
import api from '@/services/api';

export const useDocumentStore = create((set, get) => ({
  documents: [],
  collections: [],
  loading: false,
  uploading: false,
  error: '',
  success: '',

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

  createCollection: async (name) => {
    try {
      const response = await api.post('/api/collections', { name });
      set({ success: `Collection "${name}" created` });
      await get().fetchCollections();
      return response.data.collection;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to create collection' });
      throw err;
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
        success: `${file.name} uploaded successfully (${document.chunk_count || 0} chunks)`,
        uploading: false,
      });

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

  deleteDocument: async (id) => {
    if (!confirm('Are you sure you want to delete this document? Its chunks will also be removed.')) {
      return;
    }

    try {
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
