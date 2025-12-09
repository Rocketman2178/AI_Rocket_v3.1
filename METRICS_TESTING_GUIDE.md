# Metrics Tracking - Testing Guide

**Status:** ✅ Ready for Testing
**Date:** 2024-11-20

---

## 🎯 Quick Testing Checklist

### 1. Test Message Tracking

**Steps:**
1. Open the app and log in
2. Send a message in private chat to Astra
3. Wait for Astra's response

**What to Check:**
```sql
-- Check daily metrics (run after 60 seconds or app close)
SELECT * FROM user_metrics_daily
WHERE user_id = 'YOUR_USER_ID'
ORDER BY metric_date DESC
LIMIT 1;

-- Should show: messages_sent = 1 (or more)

-- Check first message milestone (new users only)
SELECT * FROM user_milestones
WHERE user_id = 'YOUR_USER_ID'
AND milestone_type = 'first_message';

-- Check performance logs
SELECT * FROM astra_performance_logs
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 5;

-- Should show: response_time_ms, success = true
```

**Console Logs to Watch:**
- `✅ Metrics flushed: { messagesSent: 1, ... }`
- `📊 Session started: [session-id]`

---

### 2. Test Report Tracking

**Steps:**
1. Go to Reports section
2. Create or run a report
3. Wait for report to complete

**What to Check:**
```sql
-- Check daily metrics
SELECT * FROM user_metrics_daily
WHERE user_id = 'YOUR_USER_ID'
ORDER BY metric_date DESC
LIMIT 1;

-- Should show: reports_generated = 1 (or more)

-- Check first report milestone (new users only)
SELECT * FROM user_milestones
WHERE user_id = 'YOUR_USER_ID'
AND milestone_type = 'first_report';
```

**Console Logs to Watch:**
- `✅ Metrics flushed: { reportsGenerated: 1, ... }`

---

### 3. Test Visualization Tracking

**Steps:**
1. Generate a visualization from Astra
2. Click "Save Visualization"
3. Wait for confirmation

**What to Check:**
```sql
-- Check daily metrics
SELECT * FROM user_metrics_daily
WHERE user_id = 'YOUR_USER_ID'
ORDER BY metric_date DESC
LIMIT 1;

-- Should show: visualizations_created = 1 (or more)

-- Check first visualization milestone (new users only)
SELECT * FROM user_milestones
WHERE user_id = 'YOUR_USER_ID'
AND milestone_type = 'first_visualization';
```

**Console Logs to Watch:**
- `✅ Metrics flushed: { visualizationsCreated: 1, ... }`

---

### 4. Test Session Tracking

**Steps:**
1. Open the app (session starts automatically)
2. Do some activity for 2-3 minutes
3. Close the browser tab or switch away

**What to Check:**
```sql
-- Check daily metrics
SELECT
  metric_date,
  sessions_count,
  total_session_duration_seconds,
  ROUND(total_session_duration_seconds::NUMERIC / sessions_count, 0) as avg_session_seconds
FROM user_metrics_daily
WHERE user_id = 'YOUR_USER_ID'
ORDER BY metric_date DESC
LIMIT 1;

-- Should show:
-- sessions_count = 1
-- total_session_duration_seconds ≈ 120-180 (2-3 minutes)
```

**Console Logs to Watch:**
- `📊 Session started: [uuid]`
- `📊 Session ended. Duration: 123 seconds`

---

### 5. Test Error Tracking

**Steps:**
1. Start typing a message
2. Disconnect your internet
3. Try to send the message (it will fail)

**What to Check:**
```sql
-- Check performance logs for errors
SELECT
  response_time_ms,
  success,
  error_message,
  mode,
  created_at
FROM astra_performance_logs
WHERE user_id = 'YOUR_USER_ID'
AND success = false
ORDER BY created_at DESC
LIMIT 5;

-- Should show: success = false, error_message with network error

-- Check daily error count
SELECT error_count
FROM user_metrics_daily
WHERE user_id = 'YOUR_USER_ID'
ORDER BY metric_date DESC
LIMIT 1;

-- Should show: error_count = 1 (or more)
```

**Console Logs to Watch:**
- `❌ Error sending message: [error details]`
- Performance log entry with success = false

---

## 📊 Sample Queries for Analysis

### Daily Active Users (Last 30 Days)
```sql
SELECT
  metric_date,
  COUNT(DISTINCT user_id) as daily_active_users,
  SUM(messages_sent) as total_messages,
  SUM(reports_generated) as total_reports,
  SUM(visualizations_created) as total_visualizations
FROM user_metrics_daily
WHERE metric_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY metric_date
ORDER BY metric_date DESC;
```

### User Engagement Summary
```sql
SELECT
  u.email,
  COUNT(DISTINCT m.metric_date) as active_days,
  SUM(m.messages_sent) as total_messages,
  SUM(m.reports_generated) as total_reports,
  SUM(m.visualizations_created) as total_visualizations,
  SUM(m.sessions_count) as total_sessions,
  ROUND(SUM(m.total_session_duration_seconds)::NUMERIC / 60, 1) as total_minutes,
  ROUND(AVG(m.total_session_duration_seconds / NULLIF(m.sessions_count, 0))::NUMERIC, 0) as avg_session_seconds
FROM users u
LEFT JOIN user_metrics_daily m ON u.id = m.user_id
WHERE m.metric_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY u.id, u.email
ORDER BY total_messages DESC;
```

### Milestone Achievement Rates
```sql
SELECT
  milestone_type,
  COUNT(*) as users_achieved,
  ROUND(COUNT(*)::NUMERIC / (SELECT COUNT(*) FROM users) * 100, 1) as achievement_rate_pct,
  MIN(achieved_at) as first_achieved,
  MAX(achieved_at) as last_achieved
FROM user_milestones
GROUP BY milestone_type
ORDER BY users_achieved DESC;
```

### AI Performance Stats (Last 7 Days)
```sql
SELECT
  DATE(created_at) as date,
  mode,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE success = true) as successful,
  COUNT(*) FILTER (WHERE success = false) as failed,
  ROUND(AVG(response_time_ms), 0) as avg_response_ms,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_time_ms), 0) as median_response_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms), 0) as p95_response_ms
FROM astra_performance_logs
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY date, mode
ORDER BY date DESC, mode;
```

### Time to First Action (Onboarding Analysis)
```sql
SELECT
  u.email,
  u.created_at as signup_date,
  m.milestone_type,
  m.achieved_at,
  EXTRACT(EPOCH FROM (m.achieved_at - u.created_at)) / 3600 as hours_to_milestone
FROM users u
JOIN user_milestones m ON u.id = m.user_id
WHERE m.milestone_type IN ('first_message', 'first_report', 'first_visualization')
ORDER BY u.created_at DESC, m.achieved_at;
```

---

## 🔧 Debugging Tips

### Metrics Not Appearing?

1. **Check Console Logs**
   - Look for `✅ Metrics flushed:` messages
   - Look for any `❌ Error flushing metrics:` errors

2. **Check Session Storage**
   ```javascript
   // Open browser console
   console.log('Session ID:', sessionStorage.getItem('astra_session_id'));
   console.log('Session Start:', sessionStorage.getItem('astra_session_start'));
   ```

3. **Manual Flush**
   ```javascript
   // If metrics aren't flushing, wait or manually trigger
   // They auto-flush every 60 seconds or at 10 events
   ```

4. **Check Database Function**
   ```sql
   -- Test the increment function directly
   SELECT increment_daily_metric(
     'YOUR_USER_ID'::uuid,
     CURRENT_DATE,
     'messages_sent',
     1
   );

   -- Then check if it worked
   SELECT * FROM user_metrics_daily
   WHERE user_id = 'YOUR_USER_ID'
   ORDER BY metric_date DESC;
   ```

### Performance Logs Not Appearing?

1. **Check if AI request completed**
   - Performance logs only created after AI responds
   - Check `astra_chats` table to see if message was saved

2. **Check for RLS issues**
   ```sql
   -- Run as authenticated user to verify RLS
   SET request.jwt.claim.sub = 'YOUR_USER_ID';
   SELECT * FROM astra_performance_logs;
   ```

### Session Tracking Not Working?

1. **Check visibility change events**
   - Mobile: Switch to another app
   - Desktop: Switch tabs or close window

2. **Check if user is authenticated**
   ```javascript
   // Tracking only works when user is logged in
   console.log('User:', user);
   ```

---

## 📈 Expected Behavior

### After Sending 1 Message:
- ✅ `user_metrics_daily`: messages_sent = 1
- ✅ `user_milestones`: first_message (if first time)
- ✅ `astra_performance_logs`: 1 entry with response time

### After 10 Messages:
- ✅ `user_metrics_daily`: messages_sent = 10
- ✅ `astra_performance_logs`: 10 entries
- ✅ Console shows metrics flushed twice (at 10 events each time)

### After 3 Sessions:
- ✅ `user_metrics_daily`: sessions_count = 3
- ✅ `total_session_duration_seconds` = sum of all session durations

### After Connecting Gmail/Drive:
- ✅ `user_milestones`: gmail_connected or drive_connected milestone

---

## ✅ Success Criteria

Your metrics tracking is working correctly if:

1. ✅ Daily metrics update within 60 seconds of activity
2. ✅ Milestones appear on first occurrence only
3. ✅ Performance logs capture every AI request
4. ✅ Sessions track correctly on open/close
5. ✅ No console errors related to metrics
6. ✅ Queries return expected data

---

## 🚨 Common Issues

### Issue: Metrics delayed by 60 seconds
**Why:** Batching is working as designed (flushes every 60s)
**Solution:** This is normal. For instant visibility, send 10 messages to trigger early flush.

### Issue: Duplicate metrics
**Why:** Race condition or double-tracking
**Solution:** Check if tracking is called multiple times in code. Each action should only track once.

### Issue: Milestones created multiple times
**Why:** Database constraint should prevent this
**Solution:** Check `UNIQUE(user_id, milestone_type)` constraint exists on `user_milestones` table.

### Issue: Performance logs missing chat_id
**Why:** Some AI requests don't have associated chat (e.g., errors before logging)
**Solution:** This is normal. `chat_id` is nullable for this reason.

---

## 📞 Support

If you encounter issues:

1. Check console logs for errors
2. Verify database tables exist and have correct permissions
3. Test database functions directly
4. Review this guide's debugging section

**All systems are operational and ready for testing!** 🚀
