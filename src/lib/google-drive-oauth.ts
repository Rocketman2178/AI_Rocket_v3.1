import { supabase } from './supabase';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Minimal scopes for Google Drive access
// Only requesting what we need: email and drive access
const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/drive'
].join(' ');

export interface GoogleDriveConnection {
  id: string;
  user_id: string;
  team_id: string | null;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  meetings_folder_id: string | null;
  meetings_folder_name: string | null;
  strategy_folder_id: string | null;
  strategy_folder_name: string | null;
  financial_folder_id: string | null;
  financial_folder_name: string | null;
  is_active: boolean;
  connection_status: 'connected' | 'error' | 'disconnected' | 'token_expired';
  last_sync_at: string | null;
  google_account_email: string;
  scope_version: number;
  created_at: string;
  updated_at: string;
}

export interface FolderInfo {
  id: string;
  name: string;
}

export const getRedirectUri = () => {
  return `${window.location.origin}/auth/google-drive/callback`;
};

/**
 * Initiates the Google Drive OAuth flow
 * Opens Google's OAuth consent screen
 */
export const initiateGoogleDriveOAuth = (fromGuidedSetup: boolean = false, fromLaunchPrep: boolean = false) => {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('Google Client ID is not configured. Please set VITE_GOOGLE_CLIENT_ID in your .env file');
  }

  const state = crypto.randomUUID();
  sessionStorage.setItem('google_drive_oauth_state', state);

  // Store flag if coming from Guided Setup
  if (fromGuidedSetup) {
    sessionStorage.setItem('google_drive_from_guided_setup', 'true');
  }

  // Store flag if coming from Launch Preparation
  if (fromLaunchPrep) {
    sessionStorage.setItem('google_drive_from_launch_prep', 'true');
  }

  const redirectUri = getRedirectUri();
  console.log('📁 Starting Google Drive OAuth flow...');
  console.log('📁 window.location.origin:', window.location.origin);
  console.log('📁 Client ID:', GOOGLE_CLIENT_ID.substring(0, 20) + '...');
  console.log('📁 Redirect URI:', redirectUri);

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.append('client_id', GOOGLE_CLIENT_ID);
  authUrl.searchParams.append('redirect_uri', redirectUri);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('scope', SCOPES);
  authUrl.searchParams.append('access_type', 'offline'); // Get refresh token
  authUrl.searchParams.append('prompt', 'consent'); // Force consent to get refresh token
  authUrl.searchParams.append('state', state);

  console.log('📁 Full auth URL:', authUrl.toString());
  console.log('📁 Redirecting to Google...');
  window.location.href = authUrl.toString();
};

/**
 * Handles the OAuth callback after user authorizes
 * Exchanges authorization code for tokens
 */
export const handleGoogleDriveCallback = async (
  code: string,
  state: string
): Promise<{ success: boolean; email: string; connection_id: string }> => {
  const savedState = sessionStorage.getItem('google_drive_oauth_state');
  if (state !== savedState) {
    throw new Error('Invalid state parameter - possible CSRF attack');
  }
  sessionStorage.removeItem('google_drive_oauth_state');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }

  const redirectUri = getRedirectUri();
  console.log('📁 Exchanging OAuth code for tokens...');
  console.log('📁 Using redirect URI:', redirectUri);

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive-oauth-exchange`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, redirect_uri: redirectUri })
    }
  );

  console.log('📁 Response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('📁 Error response:', errorText);

    let error;
    try {
      error = JSON.parse(errorText);
    } catch {
      throw new Error(`Failed to exchange code for tokens: ${errorText}`);
    }

    throw new Error(error.error || 'Failed to exchange code for tokens');
  }

  const result = await response.json();
  console.log('📁 Successfully connected Google Drive:', result.email);
  return result;
};

/**
 * Gets the user's Google Drive connection
 */
export const getGoogleDriveConnection = async (autoRefresh = false): Promise<GoogleDriveConnection | null> => {
  const { data, error } = await supabase
    .from('user_drive_connections')
    .select('*')
    .maybeSingle();

  if (error) {
    throw error;
  }

  // Auto-refresh token if expired
  if (autoRefresh && data && isTokenExpired(data.token_expires_at)) {
    console.log('📁 Token expired, auto-refreshing...');
    await refreshGoogleDriveToken();

    const { data: refreshedData } = await supabase
      .from('user_drive_connections')
      .select('*')
      .maybeSingle();

    return refreshedData;
  }

  return data;
};

/**
 * Disconnects Google Drive by deleting the connection
 */
export const disconnectGoogleDrive = async (): Promise<void> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }

  const { error } = await supabase
    .from('user_drive_connections')
    .delete()
    .eq('user_id', session.user.id);

  if (error) {
    throw error;
  }

  console.log('📁 Google Drive disconnected successfully');
};

/**
 * Checks if the access token is expired or will expire soon
 */
export const isTokenExpired = (expiresAt: string): boolean => {
  const expirationTime = new Date(expiresAt).getTime();
  const now = Date.now();
  const bufferTime = 5 * 60 * 1000; // 5 minutes buffer

  return now >= (expirationTime - bufferTime);
};

/**
 * Refreshes the Google Drive access token using the refresh token
 */
export const refreshGoogleDriveToken = async (): Promise<void> => {
  console.log('[refreshGoogleDriveToken] Starting token refresh...');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }

  console.log('[refreshGoogleDriveToken] Session found, calling edge function...');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive-refresh-token`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      }
    }
  );

  console.log('[refreshGoogleDriveToken] Response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[refreshGoogleDriveToken] Error response:', errorText);

    let error;
    try {
      error = JSON.parse(errorText);
    } catch {
      throw new Error(`Failed to refresh token: ${errorText}`);
    }

    throw new Error(error.error || 'Failed to refresh token');
  }

  const result = await response.json();
  console.log('[refreshGoogleDriveToken] Token refreshed successfully, expires at:', result.expires_at);
};

/**
 * Updates the folder configuration (meetings and/or strategy folder IDs)
 */
export const updateFolderConfiguration = async (folders: {
  meetings_folder_id?: string | null;
  meetings_folder_name?: string | null;
  strategy_folder_id?: string | null;
  strategy_folder_name?: string | null;
  financial_folder_id?: string | null;
  financial_folder_name?: string | null;
}): Promise<void> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }

  // Determine if financial sync should be enabled based on whether a folder is configured
  const updateData = {
    ...folders,
    financial_sync_enabled: folders.financial_folder_id ? true : false
  };

  const { error } = await supabase
    .from('user_drive_connections')
    .update(updateData)
    .eq('user_id', session.user.id);

  if (error) {
    throw error;
  }

  console.log('📁 Folder configuration updated successfully', updateData.financial_sync_enabled ? '(Financial sync enabled)' : '');
};

/**
 * Lists folders from user's Google Drive
 * This can be used to populate a folder picker UI
 */
export const listGoogleDriveFolders = async (): Promise<FolderInfo[]> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }

  // Use the edge function to fetch folders
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-google-drive-folders`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      }
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to list folders:', errorText);
    throw new Error('Failed to list Google Drive folders');
  }

  const data = await response.json();
  return data.folders || [];
};

/**
 * Creates a new folder in Google Drive
 * Used by Astra Guided Setup to create folders for users
 */
export const createAstraFolder = async (
  folderType: 'strategy' | 'meetings' | 'financial'
): Promise<{ folderId: string; folderName: string }> => {
  const connection = await getGoogleDriveConnection(true);

  if (!connection || !connection.is_active) {
    throw new Error('Google Drive is not connected');
  }

  const folderNames = {
    strategy: 'Astra Strategy Files',
    meetings: 'Astra Meeting Files',
    financial: 'Astra Financial Files'
  };

  const folderName = folderNames[folderType];

  console.log(`📁 Creating folder: ${folderName}`);

  // Create folder using Google Drive API
  const response = await fetch(
    'https://www.googleapis.com/drive/v3/files',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${connection.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('📁 Failed to create folder:', errorText);
    throw new Error('Failed to create folder in Google Drive');
  }

  const data = await response.json();
  console.log('📁 Folder created successfully:', data.id);

  // Update user_drive_connections with new folder based on type
  // Use the ORIGINAL columns that n8n workflow expects
  const folderMapping: Record<string, any> = {
    strategy: {
      strategy_folder_id: data.id,
      strategy_folder_name: folderName
    },
    meetings: {
      meetings_folder_id: data.id,
      meetings_folder_name: folderName
    },
    financial: {
      financial_folder_id: data.id,
      financial_folder_name: folderName
    }
  };

  await updateFolderConfiguration(folderMapping[folderType]);

  return { folderId: data.id, folderName };
};
