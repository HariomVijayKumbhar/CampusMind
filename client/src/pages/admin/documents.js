import { useState, useEffect } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import DocumentUploader from '@/components/DocumentUploader';
import { useDocumentStore } from '@/store/documentStore';

const STATUS_STYLES = {
  processing: 'bg-yellow-100 text-yellow-800',
  ready: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || 'bg-gray-100 text-gray-800';
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${style}`}
    >
      {status}
    </span>
  );
}

export default function Documents() {
  const {
    documents,
    loading,
    uploading,
    error,
    success,
    fetchDocuments,
    uploadDocument,
    deleteDocument,
    clearError,
    clearSuccess,
  } = useDocumentStore();

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    const activeDocuments = documents.filter((d) => d.status === 'processing');
    activeDocuments.forEach((d) => useDocumentStore.getState().startPolling(d.id));
  }, [documents]);

  const handleUpload = async (file) => {
    clearError();
    clearSuccess();
    await uploadDocument(file);
  };

  return (
    <ProtectedRoute adminOnly>
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Manage Documents
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Upload PDFs to build the knowledge base
              </p>
            </div>
            <Link href="/chat" className="text-sm text-blue-600 hover:text-blue-500">
              Back to Chat
            </Link>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={clearError}
                className="mt-2 text-xs text-red-600 hover:text-red-800"
              >
                Dismiss
              </button>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-700">{success}</p>
              <button
                onClick={clearSuccess}
                className="mt-2 text-xs text-green-600 hover:text-green-800"
              >
                Dismiss
              </button>
            </div>
          )}

          <DocumentUploader onUpload={handleUpload} uploading={uploading} />

          <div className="mt-8 bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">
                Documents ({documents.length})
              </h2>
            </div>

            {loading ? (
              <div className="px-6 py-8 text-center text-sm text-gray-500">
                Loading...
              </div>
            ) : documents.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-500">
                No documents uploaded yet
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-4 px-6 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {doc.title}
                        </p>
                        <StatusBadge status={doc.status || 'ready'} />
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {doc.chunk_count} chunk{doc.chunk_count === 1 ? '' : 's'} ·{' '}
                        {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteDocument(doc.id)}
                      disabled={uploading}
                      className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
