# Unified Google OAuth Architecture

## 🎯 Single OAuth for Gmail + Google Drive

Your Astra Intelligence application uses a **unified OAuth approach** where one Google authorization grants access to both Gmail and Google Drive services.

---

## ✨ How It Works

### One Authorization Flow
When a user clicks "Connect Gmail" or "Connect Google Drive":
1. User is redirected to Google OAuth consent screen
2. Google shows **all requested permissions** (Gmail + Drive)
3. User authorizes **once**
4. Application receives **one access token** with both scopes
5. Token is stored in respective tables (`gmail_auth` or `user_drive_connections`)
6. Both services can use the same token!

### Combined Scopes
```javascript
// Both gmail-oauth.ts and google-drive-oauth.ts request the same scopes:
const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',           // User profile
  'https://www.googleapis.com/auth/gmail.readonly',           // Gmail read
  'https://www.googleapis.com/auth/gmail.compose',            // Gmail compose
  'https://www.googleapis.com/auth/gmail.send',               // Gmail send
  'https://www.googleapis.com/auth/gmail.modify',             // Gmail modify
  'https://www.googleapis.com/auth/drive.readonly',           // Drive read
  'https://www.googleapis.com/auth/drive.metadata.readonly'   // Drive metadata
];
```

---

## 🏗️ Architecture Benefits

### ✅ User Experience
- **Single authorization** instead of multiple OAuth flows
- Less friction - connect once, get everything
- Clear permission request showing all services upfront
- No confusion about multiple Google connections

### ✅ Technical Simplicity
- One OAuth client ID/secret to manage
- One set of redirect URIs (Gmail and Drive callbacks)
- Simpler token refresh logic
- Less configuration overhead

### ✅ Token Management
- One token refresh flow handles both services
- Consistent token expiration across services
- Simpler error handling
- No token synchronization issues

---

## 📊 Data Storage Architecture

### Separate Tables for Different Purposes

Even though we use the same OAuth token, data is stored in separate tables:

**`gmail_auth` table:**
```sql
- Stores Gmail-specific connection data
- Used for email sync and vectorization
- Tracks last sync timestamp for emails
- No folder configuration needed
```

**`user_drive_connections` table:**
```sql
- Stores Google Drive-specific configuration
- Tracks selected folder IDs (meetings, strategy)
- Includes folder names for UI display
- Team-based isolation with team_id
```

### Why Separate Tables?

1. **Different purposes:**
   - Gmail: Email sync and search
   - Drive: Document sync from specific folders

2. **Different metadata:**
   - Gmail: Email counts, sync status, labels
   - Drive: Folder IDs, folder names, last document sync

3. **Independent lifecycle:**
   - User might disconnect Drive but keep Gmail
   - Different sync schedules and frequencies
   - Separate feature flags (GMAIL_ENABLED vs GOOGLE_DRIVE_SYNC_ENABLED)

4. **Team-based vs User-based:**
   - Gmail: Currently user-based (may become team-based)
   - Drive: Already team-based with team_id

---

## 🔄 User Flow Examples

### Scenario 1: User Connects Gmail First
```
1. User clicks "Connect Gmail"
2. OAuth requests: Gmail + Drive scopes
3. User authorizes all permissions
4. Token stored in gmail_auth table
5. Gmail sync begins

Later...
6. User clicks "Connect Google Drive"
7. OAuth requests: Same scopes (already granted!)
8. Google auto-approves (no consent screen needed)
9. Token stored in user_drive_connections table
10. User selects folders
11. Drive sync begins
```

### Scenario 2: User Connects Google Drive First
```
1. User clicks "Connect Google Drive"
2. OAuth requests: Gmail + Drive scopes
3. User authorizes all permissions
4. Token stored in user_drive_connections table
5. User selects folders, Drive sync begins

Later...
6. User clicks "Connect Gmail"
7. OAuth requests: Same scopes (already granted!)
8. Google auto-approves (no consent screen needed)
9. Token stored in gmail_auth table
10. Gmail sync begins
```

**Key Insight:** After the first authorization, subsequent connections are instant!

---

## 🔧 Implementation Details

### OAuth Libraries

**`src/lib/gmail-oauth.ts`**
```typescript
// Initiates OAuth with combined scopes
initiateGmailOAuth()

// Handles callback and stores in gmail_auth table
handleGmailCallback(code, state)

// Uses token from gmail_auth table
getGmailAuth()
```

**`src/lib/google-drive-oauth.ts`**
```typescript
// Initiates OAuth with same combined scopes
initiateGoogleDriveOAuth()

// Handles callback and stores in user_drive_connections table
handleGoogleDriveCallback(code, state)

// Uses token from user_drive_connections table
getGoogleDriveConnection()
```

### Edge Functions

**`gmail-oauth-exchange`**
- Receives OAuth code from Gmail callback
- Exchanges for access/refresh tokens
- Stores in `gmail_auth` table

**`google-drive-oauth-exchange`**
- Receives OAuth code from Drive callback
- Exchanges for access/refresh tokens
- Stores in `user_drive_connections` table

**`gmail-refresh-token` & `google-drive-refresh-token`**
- Independent refresh logic for each service
- Updates respective table when token refreshed
- Handles token expiration independently

---

## 🚀 Setup Requirements

### Google Cloud Console

**One OAuth Client ID** with:

**Authorized Redirect URIs:**
```
# Gmail callbacks
https://yourdomain.com/auth/gmail/callback
http://localhost:5173/auth/gmail/callback

# Google Drive callbacks
https://yourdomain.com/auth/google-drive/callback
http://localhost:5173/auth/google-drive/callback
```

**OAuth Scopes** (configured in consent screen):
```
✅ userinfo.email
✅ gmail.readonly
✅ gmail.compose
✅ gmail.send
✅ gmail.modify
✅ drive.readonly
✅ drive.metadata.readonly
```

### Environment Variables

**Same for both services:**
```bash
# Local .env
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

# Supabase Edge Functions
GOOGLE_CLIENT_SECRET=your-secret
GMAIL_REDIRECT_URI=https://yourdomain.com/auth/gmail/callback
GOOGLE_DRIVE_REDIRECT_URI=https://yourdomain.com/auth/google-drive/callback
```

---

## 🔒 Security Considerations

### Token Storage
- Each table stores its own copy of access/refresh tokens
- Both can be refreshed independently
- If one service is disconnected, the other continues working
- RLS policies protect data access

### Scope Management
- All scopes requested upfront (transparent to user)
- Google consent screen shows all permissions clearly
- No hidden scope escalation
- User can revoke all permissions at once in Google Account settings

### Data Isolation
- `gmail_auth`: User-scoped (for now)
- `user_drive_connections`: Team-scoped with team_id
- Separate RLS policies for each table
- No cross-contamination of data

---

## 🎨 UI/UX Considerations

### Connection Status Display

**If user has only connected Gmail:**
```
Settings:
  ✅ Gmail Integration: Connected (user@example.com)
  ⚪ Google Drive Sync: Not Connected
```

**If user has only connected Google Drive:**
```
Settings:
  ⚪ Gmail Integration: Not Connected
  ✅ Google Drive Sync: Connected (user@example.com)
```

**If user has connected both:**
```
Settings:
  ✅ Gmail Integration: Connected (user@example.com)
  ✅ Google Drive Sync: Connected (user@example.com)
     📁 Meetings: "Meeting Recordings"
     📁 Strategy: "Strategy Documents"
```

### Connect Button Behavior
- Shows "Connect Gmail" or "Connect Google Drive"
- First connection: Full OAuth consent screen
- Second connection: Instant approval (already authorized)
- User sees the simplicity even if they don't understand the technical details

---

## ❓ Common Questions

### Q: Do I need two separate OAuth clients?
**A:** No! One OAuth client handles both services.

### Q: If user disconnects Gmail, do they lose Drive access?
**A:** No. Disconnecting removes the record from `gmail_auth` but doesn't revoke the Google token. The token in `user_drive_connections` continues working.

### Q: Can users connect Drive without connecting Gmail?
**A:** Yes! The OAuth flow requests all scopes, but tables are independent.

### Q: What if I want to add more Google services later (Calendar, Contacts)?
**A:** Just add the scopes to both `gmail-oauth.ts` and `google-drive-oauth.ts`, create a new table for the service, and create new edge functions. The unified OAuth pattern scales!

### Q: Do users need to re-authorize if I add more scopes?
**A:** Yes. New scopes require user consent. Existing users will see the consent screen again when they reconnect.

---

## 📚 Related Documentation

- **Setup Guide:** `GOOGLE_OAUTH_SETUP_GUIDE.md` - Complete Google Cloud Console setup
- **Drive Integration:** `GOOGLE_DRIVE_INTEGRATION_SETUP.md` - Drive-specific features
- **Gmail Setup:** `GMAIL_SETUP.md` - Gmail-specific configuration

---

## 🎉 Summary

✅ **One OAuth client** for both Gmail and Google Drive
✅ **One authorization flow** that grants access to everything
✅ **Two separate tables** for different purposes and metadata
✅ **Independent token refresh** for each service
✅ **Better UX** - connect once, get both services
✅ **Scalable architecture** - easy to add more Google services

This unified approach gives you the best of both worlds: simplicity for users and flexibility for your architecture!
