import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  analyzeUserData,
  generateGuidedPrompts,
  saveGuidedPrompts,
  getCurrentGuidedPrompts,
  GuidedPrompt,
  UserDataSnapshot
} from '../lib/guided-chat-assistant';

export type GuidedChatState = 'idle' | 'analyzing' | 'generating' | 'ready' | 'error';

export interface UseGuidedChatReturn {
  state: GuidedChatState;
  prompts: GuidedPrompt[] | null;
  dataSnapshot: UserDataSnapshot | null;
  generationNumber: number;
  error: string | null;
  loadExistingPrompts: () => Promise<void>;
  generateNewPrompts: () => Promise<void>;
  reset: () => void;
}

export function useGuidedChat(teamId: string): UseGuidedChatReturn {
  const { user } = useAuth();
  const [state, setState] = useState<GuidedChatState>('idle');
  const [prompts, setPrompts] = useState<GuidedPrompt[] | null>(null);
  const [dataSnapshot, setDataSnapshot] = useState<UserDataSnapshot | null>(null);
  const [generationNumber, setGenerationNumber] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const loadExistingPrompts = useCallback(async () => {
    if (!user) return;

    try {
      setState('analyzing');
      const existing = await getCurrentGuidedPrompts(user.id);

      if (existing) {
        setPrompts(existing.prompts);
        setGenerationNumber(existing.generationNumber);
        setState('ready');
      } else {
        setState('idle');
      }
    } catch (err: any) {
      console.error('Error loading existing prompts:', err);
      setState('idle');
    }
  }, [user]);

  const generateNewPrompts = useCallback(async () => {
    if (!user) {
      setError('User not authenticated');
      setState('error');
      return;
    }

    try {
      setState('analyzing');
      setError(null);

      const snapshot = await analyzeUserData(user.id, teamId);
      setDataSnapshot(snapshot);

      const hasAnyData = snapshot.hasStrategyDocs || snapshot.hasMeetings || snapshot.hasFinancials || snapshot.hasProjects;

      if (!hasAnyData) {
        setError('No data available yet. Please connect Google Drive or add documents to get started.');
        setState('error');
        return;
      }

      setState('generating');

      const generatedPrompts = await generateGuidedPrompts(snapshot);
      setPrompts(generatedPrompts);

      const newGenerationNumber = generationNumber + 1;
      setGenerationNumber(newGenerationNumber);

      await saveGuidedPrompts(user.id, teamId, generatedPrompts, snapshot, newGenerationNumber);

      setState('ready');
    } catch (err: any) {
      console.error('Error generating prompts:', err);
      setError(err.message || 'Failed to generate prompts. Please try again.');
      setState('error');
    }
  }, [user, teamId, generationNumber]);

  const reset = useCallback(() => {
    setState('idle');
    setPrompts(null);
    setDataSnapshot(null);
    setError(null);
  }, []);

  return {
    state,
    prompts,
    dataSnapshot,
    generationNumber,
    error,
    loadExistingPrompts,
    generateNewPrompts,
    reset
  };
}
