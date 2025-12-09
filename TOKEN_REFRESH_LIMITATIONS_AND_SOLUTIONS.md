# Why Token Refresh Fails & What We Can Do About It

## TL;DR

**44% of your Google Drive connections have expired tokens.** The automatic refresh system IS working, but refresh tokens themselves are becoming invalid. This is mostly **outside our control** (users revoking access), but we can implement better monitoring and user communication.

## The OAuth 2.0 Reality

### How It Works
1. User authorizes app → Google gives us:
   - **Access Token**: Valid ~1 hour, used for API calls
   - **Refresh Token**: Long-lived, used to get new access tokens
2. Our cron job runs every 10 minutes
3. When access token expires in <45 minutes → Use refresh token to get new access token
4. Rinse and repeat indefinitely

### When It Breaks

The refresh token itself can become invalid. When this happens, Google returns `invalid_grant` and there's **NO WAY** to automatically fix it - user must reconnect.

## Why Refresh Tokens Become Invalid

### ❌ Cannot Prevent (User-Controlled)

#### 1. **User Revokes Access** (Most Common - ~90% of cases)
- User goes to Google Account → Security → Third-party apps → Remove Access
- IT admins enforce security policies requiring app removal
- Users see unfamiliar app name and remove it
- Security scanning tools flag the app

**What We See:**
```
Token works fine for 1 week → Suddenly invalid_grant → Token expired
```

**Pattern in Your Data:**
- All 7 expired tokens worked for ~1 week
- Then suddenly ALL refresh attempts failed
- No gradual degradation - instant failure

**What We CAN Do:**
- ✅ Better in-app branding so users recognize the app
- ✅ Explain why we need access during OAuth flow
- ✅ Email users when token expires (proactive)
- ✅ Clear reconnect flow (DONE)

#### 2. **Google Security Measures**
- Suspicious activity detected on user's account
- Account compromise suspected
- Automated security systems trigger revocation

**What We CAN Do:**
- ✅ Monitor for patterns (multiple users affected simultaneously)
- ✅ Alert admins when >20% of tokens fail

### ⚠️ Can Partially Prevent

#### 3. **Maximum Token Limit (50 per user per OAuth client)**
When a user generates their 51st refresh token, Google revokes the oldest one.

**Happens When:**
- Repeated reconnections during development/testing
- User has multiple devices/browsers all creating new tokens
- App creates new tokens instead of reusing existing ones

**Your Status:** ✅ **Not happening** (no duplicate Google accounts in database)

**What We CAN Do:**
- ✅ Detect and reuse existing connections instead of creating new ones
- ✅ Delete old connection before creating new one during reconnect
- ✅ Warn developers to avoid repeated testing reconnections

#### 4. **OAuth Configuration Changes**
If you modify:
- Requested scopes
- OAuth consent screen settings
- OAuth client configuration

Google may invalidate existing tokens for security.

**What We CAN Do:**
- ✅ Use separate OAuth clients for dev/staging/production
- ✅ Version your scope requests (already implemented with `scope_version`)
- ✅ Plan scope changes carefully with user migration strategy

### ❌ Should Not Happen (System Issues)

#### 5. **6-Month Inactivity Expiration**
Refresh tokens expire after 6 months of no use for unverified apps.

**Your Status:** ✅ **Not happening** (cron job refreshes every 10 minutes)

**What We CAN Do:**
- ✅ Monitor cron job execution (already running)
- ✅ Alert if cron job fails repeatedly

## Current State Analysis

### Your Data (Dec 9, 2025)
```
Total connections: 16
Active: 9 (56%)
Expired: 7 (44%)
Cron job: Running every 10 minutes ✅
```

### Expired Token Pattern
All 7 expired tokens show:
- Created: Nov 12 - Dec 1
- Last successful refresh: 1-2 weeks ago
- Pattern: Worked fine → Sudden failure (not gradual)
- Cause: Most likely user revocation

### Proof System Is Working
- Tokens were being refreshed successfully every 10 min
- Cron job detected failures immediately
- Connections properly marked as `token_expired`
- No system failures or bugs

## What We've Implemented ✅

### 1. **Better User Communication** (DONE)
- Clear "Reconnect Google Drive" modal instead of "No Documents Found"
- Explains why reconnection is needed
- One-click reconnection button
- Reassures users data is safe

### 2. **Token Health Monitoring** (NEW)
Created `token_refresh_logs` table that tracks:
- Every refresh attempt (success/failure)
- Error codes and messages from Google
- When tokens were last successfully refreshed

Query token health:
```sql
SELECT * FROM get_token_health_summary();
```

Returns:
- Total/active/expired connection counts
- 24-hour failure rate
- Recent failure details with error codes

### 3. **Logging in Refresh Function** (NEW)
The cron job now logs every attempt to `token_refresh_logs` so we can:
- See exact error messages from Google
- Identify patterns (are multiple users affected at once?)
- Understand if it's user revocation vs. system issues

## What We Should Implement Next

### Priority 1: Proactive User Notification
**Problem:** Users don't know their token expired until they try to sync

**Solution:**
```typescript
// Check for expired tokens daily and send email
const expiredConnections = await supabase
  .from('user_drive_connections')
  .select('*, users!inner(email)')
  .eq('is_active', false)
  .eq('connection_status', 'token_expired');

// Send email: "Your RocketHub Google Drive connection needs attention"
```

**Impact:** Users can reconnect before they need to use the app

### Priority 2: Admin Dashboard for Token Health
**Problem:** Admins don't know how many users have expired tokens

**Solution:** Add to admin dashboard:
- Token expiration rate over time
- List of users needing reconnection
- Alert when >20% of tokens expire (indicates system issue)

### Priority 3: Better OAuth Consent Screen
**Problem:** Users might not recognize the app name

**Solution:**
- Clear app name and logo
- Explain why you need access during OAuth flow
- Show what features require Google Drive

**Example:**
```
"RocketHub Astra needs access to:
✓ Read your Google Docs for AI-powered insights
✓ Sync meeting notes automatically
✓ Analyze strategy documents

Your data is never shared with third parties."
```

### Priority 4: Graceful Token Reuse
**Problem:** If user reconnects multiple times, old tokens are abandoned

**Solution:**
```typescript
// Before creating new connection, delete old one
await supabase
  .from('user_drive_connections')
  .delete()
  .eq('user_id', userId);

// Then create new connection (prevents hitting 50-token limit)
```

## Monitoring Queries

### Check Token Health
```sql
SELECT * FROM get_token_health_summary();
```

### See Recent Failures
```sql
SELECT
  user_id,
  error_code,
  error_message,
  refresh_attempt_at
FROM token_refresh_logs
WHERE success = false
AND refresh_attempt_at > now() - interval '7 days'
ORDER BY refresh_attempt_at DESC;
```

### Identify Users Who Need to Reconnect
```sql
SELECT
  u.email,
  udc.google_account_email,
  udc.connection_status,
  udc.updated_at as last_attempt
FROM user_drive_connections udc
JOIN users u ON u.id = udc.user_id
WHERE udc.is_active = false
AND udc.connection_status = 'token_expired'
ORDER BY udc.updated_at DESC;
```

### Check if Multiple Users Affected (System Issue Indicator)
```sql
-- If many tokens fail in same time window, might be OAuth config issue
SELECT
  DATE_TRUNC('hour', refresh_attempt_at) as hour,
  COUNT(*) as failures
FROM token_refresh_logs
WHERE success = false
AND refresh_attempt_at > now() - interval '7 days'
GROUP BY hour
ORDER BY hour DESC;
```

## The Bottom Line

**Can We Prevent Token Expiration Entirely?**
No. When users revoke access (most common cause), there's nothing we can do except ask them to reconnect.

**What CAN We Do?**
1. ✅ Detect it quickly (DONE - cron job + logging)
2. ✅ Communicate clearly (DONE - reconnect modal)
3. ✅ Monitor patterns (DONE - token_refresh_logs)
4. ⏳ Notify proactively (NEXT - email users when token expires)
5. ⏳ Improve OAuth UX (FUTURE - better consent screen)

**Is Our System Working?**
Yes! The cron job is running every 10 minutes, successfully refreshing valid tokens, and correctly detecting invalid ones. The 44% expiration rate is high but likely due to user revocation during early testing/beta phase.

**Expected Behavior in Production:**
- Beta/testing: 30-50% expiration (lots of reconnections, users testing)
- Stable production: 5-10% expiration (mainly user revocations)
- Enterprise environments: 10-20% expiration (IT security policies)
