import { supabase } from './supabase';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Minimal scopes for Google Drive access
// Only requesting what we need: email and drive access
const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/drive'
].join(' ');

export interface GmailAuthData {
  id: string;
  user_id: string;
  email: string;
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  expires_at: string;
  scope: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const getRedirectUri = () => {
  return `${window.location.origin}/auth/gmail/callback`;
};

export const initiateGmailOAuth = () => {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('Google Client ID is not configured. Please set VITE_GOOGLE_CLIENT_ID in your .env file');
  }

  const state = crypto.randomUUID();
  sessionStorage.setItem('gmail_oauth_state', state);

  const redirectUri = getRedirectUri();
  console.log('📧 Starting Gmail OAuth flow...');
  console.log('📧 window.location.origin:', window.location.origin);
  console.log('📧 window.location.href:', window.location.href);
  console.log('📧 Client ID:', GOOGLE_CLIENT_ID.substring(0, 20) + '...');
  console.log('📧 Redirect URI:', redirectUri);

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.append('client_id', GOOGLE_CLIENT_ID);
  authUrl.searchParams.append('redirect_uri', redirectUri);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('scope', SCOPES);
  authUrl.searchParams.append('access_type', 'offline');
  authUrl.searchParams.append('prompt', 'consent');
  authUrl.searchParams.append('state', state);

  console.log('📧 Full auth URL:', authUrl.toString());
  console.log('📧 Redirecting to Google...');
  window.location.href = authUrl.toString();
};

export const handleGmailCallback = async (code: string, state: string): Promise<{ success: boolean; email: string }> => {
  const savedState = sessionStorage.getItem('gmail_oauth_state');
  if (state !== savedState) {
    throw new Error('Invalid state parameter - possible CSRF attack');
  }
  sessionStorage.removeItem('gmail_oauth_state');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }

  const redirectUri = getRedirectUri();
  console.log('📧 Exchanging OAuth code for tokens...');
  console.log('📧 Using redirect URI:', redirectUri);

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-oauth-exchange`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, redirect_uri: redirectUri })
    }
  );

  console.log('📧 Response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('📧 Error response:', errorText);

    let error;
    try {
      error = JSON.parse(errorText);
    } catch {
      throw new Error(`Failed to exchange code for tokens: ${errorText}`);
    }

    throw new Error(error.error || 'Failed to exchange code for tokens');
  }

  const result = await response.json();
  console.log('📧 Successfully connected Gmail:', result.email);
  return result;
};

export const getGmailAuth = async (autoRefresh = false): Promise<GmailAuthData | null> => {
  const { data, error } = await supabase
    .from('gmail_auth')
    .select('*')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (autoRefresh && data && isGmailTokenExpired(data.expires_at)) {
    console.log('Token expired, auto-refreshing...');
    await refreshGmailToken();

    const { data: refreshedData } = await supabase
      .from('gmail_auth')
      .select('*')
      .maybeSingle();

    return refreshedData;
  }

  return data;
};

export const disconnectGmail = async (): Promise<void> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }

  const { error } = await supabase
    .from('gmail_auth')
    .delete()
    .eq('user_id', session.user.id);

  if (error) {
    throw error;
  }
};

export const isGmailTokenExpired = (expiresAt: string): boolean => {
  const expirationTime = new Date(expiresAt).getTime();
  const now = Date.now();
  const bufferTime = 5 * 60 * 1000;

  return now >= (expirationTime - bufferTime);
};

export const refreshGmailToken = async (): Promise<void> => {
  console.log('[refreshGmailToken] Starting token refresh...');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }

  console.log('[refreshGmailToken] Session found, calling edge function...');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-refresh-token`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      }
    }
  );

  console.log('[refreshGmailToken] Response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[refreshGmailToken] Error response:', errorText);

    let error;
    try {
      error = JSON.parse(errorText);
    } catch {
      throw new Error(`Failed to refresh token: ${errorText}`);
    }

    throw new Error(error.error || 'Failed to refresh token');
  }

  const result = await response.json();
  console.log('[refreshGmailToken] Token refreshed successfully, expires at:', result.expires_at);
};
