import { supabase } from './supabase';

export interface ManualSyncPayload {
  team_id: string;
  user_id: string;
  folder_id: string;
  folder_type: 'strategy' | 'meetings' | 'financial' | 'projects';
  access_token: string;
}

export interface ManualSyncResponse {
  success: boolean;
  message: string;
  team_id: string;
  folder_id: string;
  folder_type: string;
  files_sent?: number;
  files_failed?: number;
  completed_at?: string;
  has_files?: boolean;
  files_found?: number;
}

const MANUAL_SYNC_WEBHOOK_URL = 'https://healthrocket.app.n8n.cloud/webhook/manual-folder-sync';
const INCREMENTAL_SYNC_WEBHOOK_URL = 'https://healthrocket.app.n8n.cloud/webhook/incremental-sync-trigger';

/**
 * Triggers the incremental sync workflow
 * This is the lightweight sync that only processes new/modified files since last checkpoint
 * Use this for "Sync Now" button in user settings
 * Returns immediately - the workflow processes in background
 */
export async function triggerIncrementalSync(): Promise<{ success: boolean; message: string }> {
  console.log('Triggering incremental sync (only new files)...');

  try {
    const response = await fetch(INCREMENTAL_SYNC_WEBHOOK_URL, {
      method: 'GET',
      keepalive: true,
    });

    if (response.ok) {
      const text = await response.text();
      console.log('Incremental sync triggered successfully:', text);
      return {
        success: true,
        message: 'Incremental sync started - processing new files in background',
      };
    } else {
      console.error('Failed to trigger incremental sync:', response.status);
      return {
        success: false,
        message: 'Failed to trigger sync',
      };
    }
  } catch (error) {
    console.error('Error triggering incremental sync:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Calls the manual folder sync webhook for a single folder
 * This is the FULL sync that processes ALL files - use only for initial setup
 * For quick syncs, use triggerIncrementalSync() instead
 */
export async function triggerManualFolderSync(payload: ManualSyncPayload): Promise<ManualSyncResponse> {
  console.log('========================================');
  console.log('[triggerManualFolderSync] CALLING WEBHOOK');
  console.log('[triggerManualFolderSync] URL:', MANUAL_SYNC_WEBHOOK_URL);
  console.log('[triggerManualFolderSync] Payload:', JSON.stringify(payload, null, 2));
  console.log('========================================');

  // Fire the webhook request without waiting for completion
  // The workflow typically takes 1-2 minutes, so we use keepalive to let it run in background
  fetch(MANUAL_SYNC_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    keepalive: true, // Allow request to complete even if page navigates away
  }).then(() => {
    console.log('[triggerManualFolderSync] Webhook request completed for', payload.folder_type);
  }).catch((err) => {
    console.error('[triggerManualFolderSync] Webhook request FAILED for', payload.folder_type, ':', err);
  });

  console.log('[triggerManualFolderSync] Sync triggered successfully for', payload.folder_type, '- processing in background');

  // Return immediately with success
  return {
    success: true,
    message: 'Sync triggered successfully',
    team_id: payload.team_id,
    folder_id: payload.folder_id,
    folder_type: payload.folder_type,
    files_sent: 1, // Indicate sync was triggered
    files_failed: 0,
  };
}

/**
 * Gets the current access token for a team, refreshing if necessary
 */
async function getValidAccessToken(teamId: string, userId: string): Promise<string | null> {
  // Get the connection from user_drive_connections
  // First try to get the user's own connection
  console.log('getValidAccessToken: Querying by user_id:', userId);
  let { data: connection, error } = await supabase
    .from('user_drive_connections')
    .select('access_token, refresh_token, token_expires_at')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  console.log('getValidAccessToken: Query by user_id result:', { hasConnection: !!connection, error });

  // If user doesn't have a connection, try to get team connection
  if (!connection && !error) {
    console.log('getValidAccessToken: No connection found by user_id, trying team_id:', teamId);
    const result = await supabase
      .from('user_drive_connections')
      .select('access_token, refresh_token, token_expires_at')
      .eq('team_id', teamId)
      .eq('is_active', true)
      .maybeSingle();

    console.log('getValidAccessToken: Query by team_id result:', { hasConnection: !!result.data, error: result.error });
    connection = result.data;
    error = result.error;
  }

  if (error || !connection) {
    console.error('getValidAccessToken: Failed to get drive connection:', error);
    return null;
  }

  // Check if token is expired
  const expiresAt = new Date(connection.token_expires_at);
  const now = new Date();
  const bufferMinutes = 5; // Refresh if expiring in 5 minutes
  const needsRefresh = expiresAt.getTime() - now.getTime() < bufferMinutes * 60 * 1000;

  if (needsRefresh) {
    // Call refresh token edge function
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      console.error('No auth session available');
      return null;
    }

    try {
      const refreshResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive-refresh-token`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ team_id: teamId }),
        }
      );

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        return refreshData.access_token;
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
    }
  }

  return connection.access_token;
}

export interface SyncAllFoldersOptions {
  teamId: string;
  userId: string;
  folderTypes?: ('strategy' | 'meetings' | 'financial' | 'projects')[];
}

export interface SyncAllFoldersResult {
  success: boolean;
  results: {
    folderType: string;
    success: boolean;
    filesSent: number;
    filesFailed: number;
    error?: string;
  }[];
  totalFilesSent: number;
  totalFilesFailed: number;
}

/**
 * Syncs all configured folders for a team
 * Calls the webhook once per folder type
 */
export async function syncAllFolders(options: SyncAllFoldersOptions): Promise<SyncAllFoldersResult> {
  const { teamId, userId, folderTypes = ['strategy', 'meetings', 'financial'] } = options;

  console.log('========================================');
  console.log('[syncAllFolders] STARTING SYNC');
  console.log('[syncAllFolders] Input:', { teamId, userId, folderTypes });
  console.log('========================================');

  // First check if there's an expired/inactive connection
  console.log('Checking for expired connections...');
  let { data: expiredConnection, error: expiredError } = await supabase
    .from('user_drive_connections')
    .select('connection_status, is_active')
    .eq('user_id', userId)
    .eq('is_active', false)
    .maybeSingle();

  // Also check team connection if user connection doesn't exist
  if (!expiredConnection && !expiredError) {
    const result = await supabase
      .from('user_drive_connections')
      .select('connection_status, is_active')
      .eq('team_id', teamId)
      .eq('is_active', false)
      .maybeSingle();

    expiredConnection = result.data;
    expiredError = result.error;
  }

  // If there's an expired connection, throw specific error
  if (expiredConnection?.connection_status === 'token_expired') {
    console.error('Token is expired - user needs to reconnect');
    throw new Error('GOOGLE_TOKEN_EXPIRED');
  }

  // Get folder configuration from user_drive_connections
  // First try to get the user's own connection
  console.log('Querying by user_id:', userId);
  let { data: connection, error: connectionError } = await supabase
    .from('user_drive_connections')
    .select('strategy_folder_id, meetings_folder_id, financial_folder_id, projects_folder_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  console.log('Query by user_id result:', { connection, error: connectionError });

  // If user doesn't have a connection, try to get team connection
  if (!connection && !connectionError) {
    console.log('No connection found by user_id, trying team_id:', teamId);
    const result = await supabase
      .from('user_drive_connections')
      .select('strategy_folder_id, meetings_folder_id, financial_folder_id, projects_folder_id')
      .eq('team_id', teamId)
      .eq('is_active', true)
      .maybeSingle();

    console.log('Query by team_id result:', { data: result.data, error: result.error });
    connection = result.data;
    connectionError = result.error;
  }

  if (connectionError || !connection) {
    console.error('[syncAllFolders] Final connection error:', connectionError);
    console.error('[syncAllFolders] Final connection data:', connection);
    throw new Error('No active Google Drive connection found');
  }

  console.log('[syncAllFolders] Connection found with folders:', {
    strategy: connection.strategy_folder_id,
    meetings: connection.meetings_folder_id,
    financial: connection.financial_folder_id,
    projects: connection.projects_folder_id
  });

  // Get valid access token
  const accessToken = await getValidAccessToken(teamId, userId);
  if (!accessToken) {
    throw new Error('Failed to get valid access token');
  }

  const results: SyncAllFoldersResult['results'] = [];
  let totalFilesSent = 0;
  let totalFilesFailed = 0;

  // Sync each folder type
  console.log('[syncAllFolders] Starting to sync folder types:', folderTypes);

  for (const folderType of folderTypes) {
    const folderIdKey = `${folderType}_folder_id` as keyof typeof connection;
    const folderId = connection[folderIdKey];

    console.log(`[syncAllFolders] Processing ${folderType}: folderIdKey=${folderIdKey}, folderId=${folderId}`);

    if (!folderId) {
      console.log(`[syncAllFolders] Skipping ${folderType} - no folder configured`);
      results.push({
        folderType,
        success: false,
        filesSent: 0,
        filesFailed: 0,
        error: 'Folder not configured',
      });
      continue;
    }

    console.log(`[syncAllFolders] Calling webhook for ${folderType} with folderId=${folderId}`);

    try {
      const response = await triggerManualFolderSync({
        team_id: teamId,
        user_id: userId,
        folder_id: folderId as string,
        folder_type: folderType,
        access_token: accessToken,
      });

      results.push({
        folderType,
        success: response.success,
        filesSent: response.files_sent || 0,
        filesFailed: response.files_failed || 0,
      });

      totalFilesSent += response.files_sent || 0;
      totalFilesFailed += response.files_failed || 0;
    } catch (error) {
      console.error(`Failed to sync ${folderType} folder:`, error);
      results.push({
        folderType,
        success: false,
        filesSent: 0,
        filesFailed: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    success: results.every(r => r.success),
    results,
    totalFilesSent,
    totalFilesFailed,
  };
}
