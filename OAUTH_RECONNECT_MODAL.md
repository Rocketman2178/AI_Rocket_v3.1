# OAuth Reconnect Modal - Automatic Scope Upgrade System

## Overview
This system automatically prompts users with outdated OAuth tokens to reconnect their Google accounts when new API scopes are added.

## Problem Solved
When we add new OAuth scopes (like Google Sheets API), existing user tokens don't have the new permissions. This causes:
- 403 "Permission Denied" errors in n8n workflows
- Document sync failures
- Feature degradation

## Solution Components

### 1. Database Migration (`add_oauth_scope_version_tracking`)
- Adds `scope_version` column to `user_drive_connections`
- Marks all existing connections as version 1 (needs upgrade)
- New connections get version 2 (includes Sheets scope)
- Creates `needs_oauth_reconnection()` helper function

### 2. Updated OAuth Scopes
Added to `google-drive-oauth.ts`:
```typescript
'https://www.googleapis.com/auth/spreadsheets'
```

### 3. New React Components

#### `OAuthReconnectModal.tsx`
Beautiful, attention-grabbing modal that:
- Explains why reconnection is needed
- Lists new features (Google Sheets integration)
- Reassures users their data is safe
- Provides "Reconnect Now" button
- Allows dismissal with "Remind Me Later"

#### `useOAuthReconnectPrompt.ts` Hook
Smart hook that:
- Checks if user needs to reconnect (scope_version < 2)
- Shows modal automatically after 2 second delay
- Implements 24-hour dismissal cooldown
- Stores dismissal in localStorage
- Provides clean API for modal state management

### 4. Integration in MainContainer
Modal appears automatically for all users who:
- Have an active Google Drive connection
- Have `scope_version < 2`
- Haven't dismissed the prompt in the last 24 hours

### 5. Settings Page Warning Banner
Updated `GoogleDriveSettings.tsx` to show:
- Yellow warning banner for users with old scopes
- Clear explanation and reconnect button
- Visible in User Settings → Google Drive Sync

## User Experience Flow

### First Time Seeing Modal
1. User logs in to Astra
2. After 2 seconds, modal appears automatically
3. User sees clear explanation of why reconnection is needed
4. Two options:
   - **"Reconnect Now"** → Opens Google OAuth flow with new scopes
   - **"Remind Me Later"** → Dismisses for 24 hours

### After Dismissal
- Modal won't show again for 24 hours
- Warning banner still visible in Google Drive Settings
- If user doesn't complete OAuth flow, they'll see modal again after 24 hours

### After Reconnection
1. User clicks "Reconnect Now"
2. Google OAuth consent screen shows new Sheets permission
3. User approves
4. Token updated with `scope_version: 2`
5. Modal never shows again
6. n8n workflows work correctly
7. Document sync resumes

## Technical Details

### Scope Version Logic
- **Version 1**: Original scopes (Drive, Docs, Gmail)
- **Version 2**: All original scopes + Google Sheets
- Future scope additions increment version number

### Modal Appearance Criteria
```typescript
// Modal shows when ALL conditions are met:
- User has active Google Drive connection
- scope_version < 2 (current required version)
- No dismissal in last 24 hours (or never dismissed)
- User has been logged in for 2 seconds
```

### Modal Dismissal Storage
```typescript
localStorage.setItem('oauth_reconnect_dismissed_at', Date.now())
// Checked on every login
// 24 hour cooldown: 24 * 60 * 60 * 1000 ms
```

### Modal Priority
The OAuth Reconnect Modal:
- Shows AFTER Welcome Modal and Guided Setup complete
- Has z-index of 100 (highest priority)
- Blocks interaction until user responds
- Cannot be accidentally dismissed (requires deliberate action)

## Database Schema

```sql
-- New column in user_drive_connections
ALTER TABLE user_drive_connections 
ADD COLUMN scope_version integer DEFAULT 2;

-- Mark existing connections as needing upgrade
UPDATE user_drive_connections 
SET scope_version = 1 
WHERE scope_version IS NULL OR scope_version = 2;
```

## Testing

### Verify User Needs Reconnection
```sql
SELECT 
    u.email,
    udc.scope_version,
    udc.is_active,
    needs_oauth_reconnection(u.id) as needs_reconnect
FROM user_drive_connections udc
JOIN users u ON udc.user_id = u.id
WHERE u.email = 'test@example.com';
```

### Expected Results
- `scope_version: 1` → needs_reconnect: true
- `scope_version: 2` → needs_reconnect: false

### Manual Testing Steps
1. Log in as user with `scope_version: 1`
2. Wait 2 seconds after login
3. Modal should appear automatically
4. Click "Remind Me Later"
5. Check localStorage for `oauth_reconnect_dismissed_at`
6. Reload page → Modal should NOT appear
7. Clear localStorage or wait 24 hours
8. Reload page → Modal should appear again
9. Click "Reconnect Now"
10. Complete Google OAuth flow
11. Verify `scope_version` updated to 2
12. Modal should never appear again

## Rollout Strategy

### Immediate Impact
All users with active Google Drive connections will see the modal on their next login after deployment.

### Communication
Modal text clearly explains:
- Why reconnection is needed
- What new features are enabled
- That data is safe and preserved
- That it's a one-time update

### Gradual Adoption
- Users can dismiss for 24 hours if busy
- Warning banner remains in settings
- No forced interruption of critical workflows
- Users reconnect at their convenience

## Maintenance

### Adding Future Scopes
1. Update `SCOPES` array in `google-drive-oauth.ts`
2. Increment `required_version` in migration to 3
3. Update `scope_version: 3` in OAuth exchange function
4. Update modal text to explain new features
5. Mark all existing connections as old version

### Disabling Modal (Emergency)
If needed, can disable by updating hook:
```typescript
// In useOAuthReconnectPrompt.ts
const requiresReconnect = false; // Force disable
```

## Monitoring

### Check How Many Users Need Upgrade
```sql
SELECT 
    COUNT(*) as total_connections,
    SUM(CASE WHEN scope_version < 2 THEN 1 ELSE 0 END) as needs_upgrade,
    SUM(CASE WHEN scope_version >= 2 THEN 1 ELSE 0 END) as upgraded
FROM user_drive_connections
WHERE is_active = true;
```

### Track Reconnection Rate Over Time
```sql
SELECT 
    DATE(updated_at) as date,
    COUNT(*) as reconnections
FROM user_drive_connections
WHERE scope_version = 2
  AND updated_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(updated_at)
ORDER BY date DESC;
```

## Support

### User Reports "Modal Won't Go Away"
1. Check if they have `scope_version: 1` in database
2. Verify OAuth exchange function is working
3. Check if token is being updated correctly
4. Manual fix: Update their row to `scope_version: 2`

### User Reports "Workflows Still Failing After Reconnect"
1. Verify `scope_version: 2` in database
2. Check token has Sheets scope in Google OAuth 2.0 Playground
3. Verify n8n workflow is using fresh token
4. Check n8n workflow error logs for actual API error

## Files Modified

- `src/components/OAuthReconnectModal.tsx` (NEW)
- `src/hooks/useOAuthReconnectPrompt.ts` (NEW)
- `src/components/MainContainer.tsx` (UPDATED)
- `src/components/GoogleDriveSettings.tsx` (UPDATED)
- `src/lib/google-drive-oauth.ts` (UPDATED)
- `supabase/functions/google-drive-oauth-exchange/index.ts` (UPDATED)
- `supabase/migrations/20251124220910_add_oauth_scope_version_tracking.sql` (NEW)
