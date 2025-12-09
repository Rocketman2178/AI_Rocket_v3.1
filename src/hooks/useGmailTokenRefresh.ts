import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { refreshGmailToken, isGmailTokenExpired } from '../lib/gmail-oauth';

/**
 * Hook that automatically refreshes Gmail tokens in the background
 * This ensures n8n workflows always have valid tokens
 *
 * @param enabled - Whether the token refresh service should be active
 */
export const useGmailTokenRefresh = (enabled: boolean = true) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);

  const checkAndRefreshToken = async () => {
    // Prevent concurrent refresh attempts
    if (isRefreshingRef.current) {
      console.log('[useGmailTokenRefresh] Refresh already in progress, skipping...');
      return;
    }

    try {
      isRefreshingRef.current = true;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('[useGmailTokenRefresh] No active session, skipping token check');
        return;
      }

      // Check if user has Gmail connected
      const { data: gmailAuth, error } = await supabase
        .from('gmail_auth')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('[useGmailTokenRefresh] Error checking Gmail auth:', error);
        return;
      }

      if (!gmailAuth) {
        console.log('[useGmailTokenRefresh] No active Gmail connection found');
        return;
      }

      // Check if token is expired or will expire soon (within 5 minutes)
      const isExpired = isGmailTokenExpired(gmailAuth.expires_at);

      if (isExpired) {
        console.log('[useGmailTokenRefresh] Token expired, refreshing...');
        console.log('[useGmailTokenRefresh] Token expires at:', gmailAuth.expires_at);

        await refreshGmailToken();

        console.log('[useGmailTokenRefresh] ✅ Token refreshed successfully');
      } else {
        const expiresIn = new Date(gmailAuth.expires_at).getTime() - Date.now();
        const minutesUntilExpiry = Math.floor(expiresIn / 1000 / 60);
        console.log(`[useGmailTokenRefresh] Token is valid for ${minutesUntilExpiry} more minutes`);
      }
    } catch (err: any) {
      console.error('[useGmailTokenRefresh] Error during token refresh:', err);
    } finally {
      isRefreshingRef.current = false;
    }
  };

  useEffect(() => {
    // Skip if feature is disabled
    if (!enabled) {
      console.log('[useGmailTokenRefresh] Gmail feature is disabled, skipping token refresh service');
      return;
    }

    console.log('[useGmailTokenRefresh] Starting automatic token refresh service');

    // Check immediately on mount
    checkAndRefreshToken();

    // Then check every 5 minutes
    intervalRef.current = setInterval(() => {
      console.log('[useGmailTokenRefresh] Running scheduled token check...');
      checkAndRefreshToken();
    }, 5 * 60 * 1000); // 5 minutes

    // Cleanup on unmount
    return () => {
      console.log('[useGmailTokenRefresh] Stopping automatic token refresh service');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled]);

  return { checkAndRefreshToken };
};
