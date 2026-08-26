import { useState, useEffect } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import ProtectedRoute from '@/components/ProtectedRoute';
import DocumentUploader from '@/components/DocumentUploader';
import { useDocumentStore } from '@/store/documentStore';

function StatusBadge({ status }) {
  if (status === 'processing') {
    return (
      <span className="badge-processing">
        <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        Processing
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="badge-failed">
        <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd"/>
        </svg>
        Failed
      </span>
    );
  }
  return (
    <span className="badge-ready">
      <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd"/>
      </svg>
      Ready
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
      <Head>
        <title>Manage Documents — CampusMind Admin</title>
        <meta name="description" content="Upload and manage knowledge base documents for CampusMind." />
      </Head>

      <div className="min-h-screen px-4 py-8 sm:px-6 sm:py-12" style={{ background: 'rgb(15,15,23)' }}>
        <div className="mx-auto max-w-4xl space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-lg bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-400 border border-violet-500/20 mb-2">
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd"/>
                </svg>
                Admin Workspace
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Knowledge Base</h1>
              <p className="mt-1 text-sm text-slate-400">Upload PDF documents to train your RAG chatbot</p>
            </div>
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-all hover:border-violet-500/40 hover:bg-white/10 hover:text-white self-start sm:self-auto"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/>
              </svg>
              Back to Chat
            </Link>
          </div>

          {/* Banners */}
          {error && (
            <div className="cm-banner-error justify-between animate-fade-in">
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 shrink-0 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
                </svg>
                {error}
              </span>
              <button onClick={clearError} className="text-xs text-red-400 hover:text-red-200">Dismiss</button>
            </div>
          )}

          {success && (
            <div className="cm-banner-success justify-between animate-fade-in">
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 shrink-0 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd"/>
                </svg>
                {success}
              </span>
              <button onClick={clearSuccess} className="text-xs text-emerald-400 hover:text-emerald-200">Dismiss</button>
            </div>
          )}

          {/* Document Uploader Card */}
          <DocumentUploader onUpload={handleUpload} uploading={uploading} />

          {/* Document List */}
          <div className="overflow-hidden rounded-2xl border border-white/10" style={{ background: 'rgba(22,22,34,0.7)', backdropFilter: 'blur(16px)' }}>
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <svg className="h-4 w-4 text-violet-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/>
                </svg>
                Uploaded Documents
              </h2>
              <span className="rounded-full bg-white/5 border border-white/10 px-3 py-0.5 text-xs font-semibold text-slate-300">
                {documents.length} document{documents.length !== 1 ? 's' : ''}
              </span>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-12 gap-3">
                <svg className="h-5 w-5 animate-spin text-violet-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <span className="text-sm text-slate-400">Loading documents...</span>
              </div>
            ) : documents.length === 0 ? (
              <div className="py-16 text-center">
                <svg className="mx-auto h-12 w-12 text-slate-600 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
                </svg>
                <p className="text-sm font-medium text-slate-300">No documents uploaded yet</p>
                <p className="mt-1 text-xs text-slate-500">Upload a PDF above to start building your college knowledge base.</p>
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-white/5 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
                          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/>
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            {doc.title}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {doc.chunk_count} chunk{doc.chunk_count === 1 ? '' : 's'} · Added {new Date(doc.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <StatusBadge status={doc.status || 'ready'} />
                      <button
                        type="button"
                        onClick={() => deleteDocument(doc.id)}
                        disabled={uploading}
                        className="cm-btn-danger"
                      >
                        Delete
                      </button>
                    </div>
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
