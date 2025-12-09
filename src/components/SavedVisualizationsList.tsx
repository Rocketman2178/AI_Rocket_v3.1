import React, { useState } from 'react';
import { ArrowLeft, Trash2, Eye, Loader } from 'lucide-react';
import { format } from 'date-fns';
import type { Database } from '../lib/supabase';
import { VisualizationView } from './VisualizationView';

type SavedVisualization = Database['public']['Tables']['saved_visualizations']['Row'];

interface SavedVisualizationsListProps {
  savedVisualizations: SavedVisualization[];
  onBack: () => void;
  onDelete: (id: string) => Promise<void>;
  loading: boolean;
}

export const SavedVisualizationsList: React.FC<SavedVisualizationsListProps> = ({
  savedVisualizations,
  onBack,
  onDelete,
  loading
}) => {
  const [viewingVisualization, setViewingVisualization] = useState<SavedVisualization | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this saved visualization?')) return;

    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  if (viewingVisualization) {
    return (
      <VisualizationView
        content={viewingVisualization.visualization_data}
        onBack={() => setViewingVisualization(null)}
        title={viewingVisualization.title}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <header className="bg-gradient-to-r from-blue-600 to-purple-700 shadow-lg">
        <div className="flex items-center py-4 px-6">
          <button
            onClick={onBack}
            className="mr-4 p-2 hover:bg-blue-700 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-xl font-bold text-white">
            My Visualizations
          </h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : savedVisualizations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Eye className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg">No saved visualizations yet</p>
            <p className="text-sm mt-2">Save visualizations from your chats to view them here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {savedVisualizations.map((viz) => (
              <div
                key={viz.id}
                className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-blue-500 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => setViewingVisualization(viz)}
                    className="flex-1 text-left min-h-[44px] touch-manipulation"
                  >
                    <h3 className="text-white font-semibold mb-1 line-clamp-2">
                      {viz.title}
                    </h3>
                    <p className="text-gray-400 text-sm">
                      Saved {format(new Date(viz.saved_at), 'MMM d, yyyy \'at\' h:mm a')}
                    </p>
                    {viz.original_prompt && (
                      <p className="text-gray-500 text-xs mt-2 line-clamp-2">
                        {viz.original_prompt}
                      </p>
                    )}
                  </button>

                  <button
                    onClick={() => handleDelete(viz.id)}
                    disabled={deletingId === viz.id}
                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation disabled:opacity-50"
                  >
                    {deletingId === viz.id ? (
                      <Loader className="w-5 h-5 animate-spin" />
                    ) : (
                      <Trash2 className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
