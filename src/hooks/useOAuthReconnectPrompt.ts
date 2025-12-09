import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const RECONNECT_PROMPT_DISMISSED_KEY = 'oauth_reconnect_dismissed_at';
const REMIND_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export const useOAuthReconnectPrompt = () => {
  const [showModal, setShowModal] = useState(false);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkReconnectNeeded();
  }, []);

  const checkReconnectNeeded = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Check if user has a Google Drive connection with outdated scope
      const { data: connection } = await supabase
        .from('user_drive_connections')
        .select('scope_version, is_active')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!connection || !connection.is_active) {
        setLoading(false);
        return;
      }

      const scopeVersion = connection.scope_version || 1;
      const requiresReconnect = scopeVersion < 2;

      console.log('🔍 [OAuth Reconnect Check]', {
        userId: user.id,
        scopeVersion,
        requiresReconnect
      });

      setNeedsReconnect(requiresReconnect);

      if (requiresReconnect) {
        // Check if user has dismissed the prompt recently
        const dismissedAt = localStorage.getItem(RECONNECT_PROMPT_DISMISSED_KEY);
        if (dismissedAt) {
          const timeSinceDismissed = Date.now() - parseInt(dismissedAt, 10);
          if (timeSinceDismissed < REMIND_INTERVAL_MS) {
            console.log('🔕 [OAuth Reconnect] Prompt dismissed recently, skipping');
            setLoading(false);
            return;
          }
        }

        // Show the modal after a brief delay for better UX
        setTimeout(() => {
          setShowModal(true);
        }, 2000);
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to check OAuth reconnect status:', error);
      setLoading(false);
    }
  };

  const dismissModal = () => {
    setShowModal(false);
    localStorage.setItem(RECONNECT_PROMPT_DISMISSED_KEY, Date.now().toString());
    console.log('🔕 [OAuth Reconnect] User dismissed modal, will remind in 24 hours');
  };

  const handleReconnect = () => {
    setShowModal(false);
    // Clear the dismissed flag so if they don't complete the flow, they'll see it again
    localStorage.removeItem(RECONNECT_PROMPT_DISMISSED_KEY);
    console.log('🔄 [OAuth Reconnect] User initiated reconnection');
  };

  return {
    showModal,
    needsReconnect,
    loading,
    dismissModal,
    handleReconnect
  };
};
