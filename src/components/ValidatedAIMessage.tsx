import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { validateAIResponse } from '../lib/hallucination-detector';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ValidationResult {
  isValid: boolean;
  confidence: 'high' | 'medium' | 'low';
  issues: string[];
  warnings: string[];
}

interface ValidatedAIMessageProps {
  message: string;
  messageId?: string;
  teamId: string;
  children: React.ReactNode;
  onValidationComplete?: (result: ValidationResult) => void;
}

/**
 * Wrapper component that validates AI responses and shows a subtle warning indicator if needed
 */
export function ValidatedAIMessage({
  message,
  messageId,
  teamId,
  children,
  onValidationComplete
}: ValidatedAIMessageProps) {
  const { user } = useAuth();
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    validateMessage();
  }, [message, teamId]);

  const validateMessage = async () => {
    setIsValidating(true);
    try {
      const result = await validateAIResponse(message, teamId);
      setValidation(result);

      // Log validation results to database if there are warnings or failures
      if (!result.isValid || result.warnings.length > 0 || result.confidence !== 'high') {
        try {
          await supabase.from('ai_validation_logs').insert({
            message_id: messageId || 'unknown',
            team_id: teamId,
            user_id: user?.id,
            is_valid: result.isValid,
            confidence: result.confidence,
            issues: result.issues,
            warnings: result.warnings,
            message_preview: message.substring(0, 200)
          });
        } catch (logError) {
          console.error('Failed to log validation result:', logError);
        }
      }

      if (onValidationComplete) {
        onValidationComplete(result);
      }
    } catch (error) {
      console.error('Validation error:', error);
      // On error, assume valid and don't show warning
      setValidation({
        isValid: true,
        confidence: 'high',
        issues: [],
        warnings: []
      });
    } finally {
      setIsValidating(false);
    }
  };

  // Show message normally while validating
  if (isValidating) {
    return <div>{children}</div>;
  }

  // Check if we have any issues or warnings
  const hasIssues = validation && (!validation.isValid || validation.issues.length > 0);
  const hasWarnings = validation && validation.warnings.length > 0;
  const shouldShowIndicator = hasIssues || hasWarnings;

  return (
    <div className="relative">
      {/* Subtle warning indicator in top-right corner */}
      {shouldShowIndicator && (
        <div className="absolute -top-2 -right-2 z-10">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className={`flex items-center justify-center w-6 h-6 rounded-full shadow-lg transition-all duration-200 hover:scale-110 ${
              hasIssues
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-yellow-500 hover:bg-yellow-600'
            }`}
            title={hasIssues ? 'Validation warning - click for details' : 'Minor warning - click for details'}
          >
            <AlertTriangle className="w-4 h-4 text-white" />
          </button>
        </div>
      )}

      {/* Show the actual message content - ALWAYS visible */}
      <div>{children}</div>

      {/* Details modal/popup when user clicks the indicator */}
      {showDetails && shouldShowIndicator && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDetails(false)}>
          <div
            className={`bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6 ${
              hasIssues ? 'border-2 border-red-500' : 'border-2 border-yellow-500'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${
                  hasIssues ? 'bg-red-500/20' : 'bg-yellow-500/20'
                }`}>
                  <AlertTriangle className={`w-6 h-6 ${
                    hasIssues ? 'text-red-400' : 'text-yellow-400'
                  }`} />
                </div>
                <div>
                  <h3 className={`text-lg font-semibold ${
                    hasIssues ? 'text-red-400' : 'text-yellow-400'
                  }`}>
                    {hasIssues ? 'Validation Warning' : 'Minor Notice'}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {hasIssues ? 'This response may contain inaccurate information' : 'Some details in this response'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Issues */}
            {validation!.issues.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-red-400 mb-2">Issues Detected:</h4>
                <div className="space-y-2">
                  {validation!.issues.map((issue, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span>{issue}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {validation!.warnings.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-yellow-400 mb-2">Warnings:</h4>
                <div className="space-y-2">
                  {validation!.warnings.map((warning, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-yellow-400 mt-0.5">•</span>
                      <span>{warning}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendation */}
            <div className="mt-4 p-3 bg-gray-700/50 rounded border border-gray-600">
              <p className="text-xs text-gray-400">
                <strong className="text-white">Recommendation:</strong> {hasIssues
                  ? 'Please verify this information before taking action. The response may reference incorrect data.'
                  : 'This information appears generally accurate but contains some details we couldn\'t verify against your team data.'}
              </p>
            </div>

            {/* Close button */}
            <button
              onClick={() => setShowDetails(false)}
              className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors font-medium"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
