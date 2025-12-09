import React, { useState, useEffect } from 'react';
import { FileText, ExternalLink, Upload, Sparkles, CheckCircle2, X, Info } from 'lucide-react';
import { SetupGuideProgress } from '../../lib/setup-guide-utils';
import { StrategyDocumentModal } from '../StrategyDocumentModal';
import { supabase } from '../../lib/supabase';

interface PlaceFilesStepProps {
  onComplete: () => void;
  progress: SetupGuideProgress | null;
  folderData: any;
}

type ViewMode = 'choose-option' | 'waiting-for-files' | 'document-created';

export const PlaceFilesStep: React.FC<PlaceFilesStepProps> = ({ onComplete, folderData, progress }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('choose-option');
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [createdDocumentId, setCreatedDocumentId] = useState('');
  const [actualFolderId, setActualFolderId] = useState<string>('');
  const [showConversionModal, setShowConversionModal] = useState(false);

  // Fetch folder ID from multiple sources as fallback
  useEffect(() => {
    const fetchFolderId = async () => {
      // Try folderData first (from props)
      if (folderData?.selectedFolder?.id) {
        setActualFolderId(folderData.selectedFolder.id);
        return;
      }

      // Try progress data (from database)
      if (progress?.created_folder_id) {
        setActualFolderId(progress.created_folder_id);
        return;
      }

      // Fallback: fetch from user_drive_connections
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const teamId = user.user_metadata?.team_id;
        if (!teamId) return;

        const { data: connection } = await supabase
          .from('user_drive_connections')
          .select('strategy_folder_id')
          .eq('team_id', teamId)
          .eq('is_active', true)
          .maybeSingle();

        if (connection?.strategy_folder_id) {
          setActualFolderId(connection.strategy_folder_id);
        }
      } catch (error) {
        console.error('Error fetching folder ID:', error);
      }
    };

    fetchFolderId();
  }, [folderData, progress]);

  // Check if step 4 is already completed and set view accordingly
  useEffect(() => {
    if (progress?.step_4_files_placed_in_folder) {
      console.log('Step 4 already completed, showing document-created view');
      setViewMode('document-created');
    } else {
      console.log('Step 4 not completed, showing choose-option view');
      setViewMode('choose-option');
    }
  }, [progress?.step_4_files_placed_in_folder]);

  const handleHasFiles = () => {
    setViewMode('waiting-for-files');
  };

  const handleCreateStrategyDocument = () => {
    setShowDocumentModal(true);
  };

  const handleDocumentCreated = async (documentId: string) => {
    setCreatedDocumentId(documentId);
    setShowDocumentModal(false);
    setViewMode('document-created');
  };

  const handleProceedToSync = () => {
    onComplete();
  };

  const openGoogleDrive = () => {
    if (actualFolderId) {
      window.open(`https://drive.google.com/drive/folders/${actualFolderId}`, '_blank');
    } else {
      window.open('https://drive.google.com', '_blank');
    }
  };

  // Initial view - Choose between two options
  if (viewMode === 'choose-option') {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-yellow-600/20 mb-3">
            <Upload className="w-7 h-7 text-yellow-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Place Your Files</h2>
          <p className="text-sm text-gray-300">
            Add at least one document to your folder, then return here to proceed
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={handleHasFiles}
            className="bg-purple-900/20 hover:bg-purple-800/30 border-2 border-purple-700 hover:border-purple-500 rounded-lg p-4 transition-all group min-h-[140px] flex flex-col items-center justify-center"
          >
            <div className="w-12 h-12 rounded-full bg-purple-600/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Upload className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1 text-center">
              I have files to put in my folder
            </h3>
            <p className="text-xs text-gray-400 text-center">
              I'll place my existing strategy documents in the folder
            </p>
          </button>

          <button
            onClick={handleCreateStrategyDocument}
            className="bg-blue-900/20 hover:bg-blue-800/30 border-2 border-blue-700 hover:border-blue-500 rounded-lg p-4 transition-all group min-h-[140px] flex flex-col items-center justify-center"
          >
            <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Sparkles className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1 text-center">
              Help me create my first file
            </h3>
            <p className="text-xs text-gray-400 text-center">
              Let Astra help you create a strategy document
            </p>
          </button>
        </div>

        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🎯</span>
            <h4 className="text-white text-sm font-semibold">Strategy Documents Include:</h4>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-blue-950/50 rounded-lg p-2 flex items-center gap-2">
              <span className="text-lg">📜</span>
              <span className="text-xs text-blue-200">Mission</span>
            </div>
            <div className="bg-blue-950/50 rounded-lg p-2 flex items-center gap-2">
              <span className="text-lg">⭐</span>
              <span className="text-xs text-blue-200">Values</span>
            </div>
            <div className="bg-blue-950/50 rounded-lg p-2 flex items-center gap-2">
              <span className="text-lg">🎯</span>
              <span className="text-xs text-blue-200">Goals</span>
            </div>
            <div className="bg-blue-950/50 rounded-lg p-2 flex items-center gap-2">
              <span className="text-lg">🗺️</span>
              <span className="text-xs text-blue-200">Plans</span>
            </div>
          </div>

          {actualFolderId && (
            <button
              onClick={openGoogleDrive}
              className="text-xs text-green-400 hover:text-green-300 underline flex items-center gap-1 mx-auto"
            >
              <ExternalLink className="w-3 h-3" />
              Open your Google Drive folder
            </button>
          )}
        </div>

        <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-lg p-4">
          <h4 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            Supported File Types
          </h4>

          <div className="grid grid-cols-2 gap-2">
            {/* Supported */}
            <div className="bg-green-900/20 border border-green-700 rounded-lg p-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span className="text-lg">📄</span>
              <span className="text-xs text-white font-medium">Google Docs</span>
            </div>
            <div className="bg-green-900/20 border border-green-700 rounded-lg p-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span className="text-lg">📊</span>
              <span className="text-xs text-white font-medium">Google Sheets</span>
            </div>

            {/* Not Supported */}
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-2 flex items-center gap-2 opacity-60">
              <X className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span className="text-lg">📕</span>
              <span className="text-xs text-gray-400 font-medium">PDF Files</span>
            </div>
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-2 flex items-center gap-2 opacity-60">
              <X className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span className="text-lg">📝</span>
              <span className="text-xs text-gray-400 font-medium">Word/Excel</span>
            </div>
          </div>

          <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-2 mt-3">
            <p className="text-xs text-blue-200">
              <span className="font-medium">💡 Tip:</span> Convert other file types to Google Docs/Sheets in Drive
            </p>
          </div>

          <button
            onClick={() => setShowConversionModal(true)}
            className="w-full bg-gray-900/50 hover:bg-gray-800/70 border border-gray-600 hover:border-blue-500 rounded-lg p-2 mt-2 transition-colors flex items-center justify-center gap-2"
          >
            <Info className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-300 font-medium">How to Convert Files to Google Docs/Sheets</span>
          </button>

          <div className="bg-gray-900/50 border border-gray-600 rounded-lg p-2 mt-2">
            <p className="text-xs text-gray-400 text-center">
              ℹ️ More file types may be supported in future updates
            </p>
          </div>
        </div>

        {showDocumentModal && (
          <StrategyDocumentModal
            isOpen={showDocumentModal}
            onClose={() => setShowDocumentModal(false)}
            folderId={actualFolderId}
            onSuccess={handleDocumentCreated}
          />
        )}

        {showConversionModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-lg border border-gray-700 max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-400" />
                  <h3 className="text-lg font-semibold text-white">Convert Files to Google Docs/Sheets</h3>
                </div>
                <button
                  onClick={() => setShowConversionModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3">
                  <p className="text-sm text-blue-200">
                    Converting file types to Google Docs for: PDF, Word, Excel, Text, etc.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-white font-semibold text-sm">How to Convert:</h4>

                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600/20 flex items-center justify-center">
                        <span className="text-xs text-blue-400 font-medium">1</span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-300">
                          <span className="font-medium text-white">Locate the file</span> in your Google Drive.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600/20 flex items-center justify-center">
                        <span className="text-xs text-blue-400 font-medium">2</span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-300">
                          <span className="font-medium text-white">Right-click</span> on the file.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600/20 flex items-center justify-center">
                        <span className="text-xs text-blue-400 font-medium">3</span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-300">
                          <span className="font-medium text-white">Hover over "Open with"</span> and select the suggested Google app (e.g., <span className="font-medium text-blue-400">Google Docs</span>, <span className="font-medium text-green-400">Google Sheets</span>, or <span className="font-medium text-orange-400">Google Slides</span>).
                        </p>
                      </div>
                    </div>

                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 mt-3">
                      <p className="text-xs text-gray-300">
                        Google will automatically convert the file into the corresponding Google format. It may take a moment to process, but once it opens, you will have the content available to edit.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-green-900/20 border border-green-700 rounded-lg p-3">
                  <p className="text-xs text-green-300">
                    <span className="font-medium">✓ Tip:</span> The converted file will be a new Google Doc/Sheet, and your original file remains unchanged.
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setShowConversionModal(false)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors min-h-[44px]"
                  >
                    Got it
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // View for waiting for user to place files
  if (viewMode === 'waiting-for-files') {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-yellow-600/20 mb-3">
            <Upload className="w-7 h-7 text-yellow-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Place Your Files</h2>
          <p className="text-sm text-gray-300">
            Add at least one document to your folder, then return here to proceed
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-white text-sm font-medium mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-yellow-400" />
            Instructions:
          </h3>
          <ol className="space-y-2 text-xs text-gray-300">
            <li className="flex items-start space-x-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-yellow-600/20 flex items-center justify-center text-xs text-yellow-400 font-medium">
                1
              </span>
              <span>Click the button below to open your Google Drive folder in a new window</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-yellow-600/20 flex items-center justify-center text-xs text-yellow-400 font-medium">
                2
              </span>
              <span>Upload or move at least one Strategy Document into the folder</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-yellow-600/20 flex items-center justify-center text-xs text-yellow-400 font-medium">
                3
              </span>
              <span>Return to this page and click "Proceed to Sync" to continue</span>
            </li>
          </ol>
        </div>

        <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-lg p-4">
          <h4 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            Supported File Types
          </h4>

          <div className="grid grid-cols-2 gap-3 mb-3">
            {/* Supported Files */}
            <div className="space-y-2">
              <div className="bg-green-900/20 border border-green-700 rounded-lg p-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-2xl">📄</span>
                  <span className="text-xs text-white font-medium">Google Docs</span>
                </div>
              </div>
              <div className="bg-green-900/20 border border-green-700 rounded-lg p-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-2xl">📊</span>
                  <span className="text-xs text-white font-medium">Google Sheets</span>
                </div>
              </div>
            </div>

            {/* Unsupported Files */}
            <div className="space-y-2">
              <div className="bg-red-900/20 border border-red-700 rounded-lg p-2 flex items-center gap-2 opacity-60">
                <X className="w-4 h-4 text-red-400 flex-shrink-0" />
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-2xl">📕</span>
                  <span className="text-xs text-gray-400 font-medium">PDF Files</span>
                </div>
              </div>
              <div className="bg-red-900/20 border border-red-700 rounded-lg p-2 flex items-center gap-2 opacity-60">
                <X className="w-4 h-4 text-red-400 flex-shrink-0" />
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-2xl">📝</span>
                  <span className="text-xs text-gray-400 font-medium">Word Docs</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-2 flex items-center gap-2 opacity-60">
              <X className="w-4 h-4 text-red-400 flex-shrink-0" />
              <div className="flex items-center gap-2 flex-1">
                <span className="text-2xl">📗</span>
                <span className="text-xs text-gray-400 font-medium">Excel Files</span>
              </div>
            </div>
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-2 flex items-center gap-2 opacity-60">
              <X className="w-4 h-4 text-red-400 flex-shrink-0" />
              <div className="flex items-center gap-2 flex-1">
                <span className="text-2xl">📁</span>
                <span className="text-xs text-gray-400 font-medium">Other Files</span>
              </div>
            </div>
          </div>

          <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-2">
            <p className="text-xs text-blue-200">
              <span className="font-medium">💡 Tip:</span> Convert PDFs, Word docs, and Excel files to Google Docs/Sheets in your Drive
            </p>
          </div>

          <button
            onClick={() => setShowConversionModal(true)}
            className="w-full bg-gray-900/50 hover:bg-gray-800/70 border border-gray-600 hover:border-blue-500 rounded-lg p-2 mt-2 transition-colors flex items-center justify-center gap-2"
          >
            <Info className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-300 font-medium">How to Convert Files to Google Docs/Sheets</span>
          </button>

          <div className="bg-gray-900/50 border border-gray-600 rounded-lg p-2 mt-2">
            <p className="text-xs text-gray-400 text-center">
              ℹ️ More file types may be supported in future updates
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
          <button
            onClick={openGoogleDrive}
            className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2 min-h-[44px]"
          >
            <span>Open Google Drive</span>
            <ExternalLink className="w-4 h-4" />
          </button>
          <button
            onClick={handleProceedToSync}
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center space-x-2 min-h-[44px]"
          >
            <span>Proceed to Sync →</span>
          </button>
        </div>

        {showConversionModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-lg border border-gray-700 max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-400" />
                  <h3 className="text-lg font-semibold text-white">Convert Files to Google Docs/Sheets</h3>
                </div>
                <button
                  onClick={() => setShowConversionModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3">
                  <p className="text-sm text-blue-200">
                    Converting file types to Google Docs for: PDF, Word, Excel, Text, etc.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-white font-semibold text-sm">How to Convert:</h4>

                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600/20 flex items-center justify-center">
                        <span className="text-xs text-blue-400 font-medium">1</span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-300">
                          <span className="font-medium text-white">Locate the file</span> in your Google Drive.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600/20 flex items-center justify-center">
                        <span className="text-xs text-blue-400 font-medium">2</span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-300">
                          <span className="font-medium text-white">Right-click</span> on the file.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600/20 flex items-center justify-center">
                        <span className="text-xs text-blue-400 font-medium">3</span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-300">
                          <span className="font-medium text-white">Hover over "Open with"</span> and select the suggested Google app (e.g., <span className="font-medium text-blue-400">Google Docs</span>, <span className="font-medium text-green-400">Google Sheets</span>, or <span className="font-medium text-orange-400">Google Slides</span>).
                        </p>
                      </div>
                    </div>

                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 mt-3">
                      <p className="text-xs text-gray-300">
                        Google will automatically convert the file into the corresponding Google format. It may take a moment to process, but once it opens, you will have the content available to edit.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-green-900/20 border border-green-700 rounded-lg p-3">
                  <p className="text-xs text-green-300">
                    <span className="font-medium">✓ Tip:</span> The converted file will be a new Google Doc/Sheet, and your original file remains unchanged.
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setShowConversionModal(false)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors min-h-[44px]"
                  >
                    Got it
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // View after strategy document has been created
  if (viewMode === 'document-created') {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-600/20 mb-3">
            <FileText className="w-7 h-7 text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Strategy Document Created!</h2>
          <p className="text-sm text-gray-300">
            Your Strategy Document has been successfully created and saved to your folder
          </p>
        </div>

        <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
          <h3 className="text-white text-sm font-medium mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4 text-green-400" />
            What's Next?
          </h3>
          <p className="text-xs text-green-300 mb-2">
            Your Strategy Document is ready to be synced with Astra. Once synced, Astra will be able to:
          </p>
          <ul className="space-y-1 text-xs text-green-300">
            <li className="flex items-start space-x-2">
              <span className="text-green-400">✓</span>
              <span>Answer questions about your team's mission and goals</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-green-400">✓</span>
              <span>Provide insights aligned with your strategic direction</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-green-400">✓</span>
              <span>Help your team stay focused on core objectives</span>
            </li>
          </ul>
        </div>

        <div className="flex items-center justify-center gap-2">
          <button
            onClick={openGoogleDrive}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 min-h-[44px]"
          >
            <span>View Document</span>
            <ExternalLink className="w-4 h-4" />
          </button>
          <button
            onClick={handleProceedToSync}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg text-sm font-medium transition-all flex items-center space-x-2 min-h-[44px]"
          >
            <span>Proceed to Sync →</span>
          </button>
        </div>
      </div>
    );
  }

  return null;
};
