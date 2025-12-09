# Metrics Tracking - Visual Flow Summary

**Implementation Status:** ✅ Complete & Deployed
**Last Updated:** 2024-11-20

---

## 📊 Tracking Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERACTIONS                            │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
            ┌──────────┐   ┌──────────┐   ┌──────────┐
            │   CHAT   │   │ REPORTS  │   │  VISUAL  │
            │ Messages │   │Generation│   │   Save   │
            └──────────┘   └──────────┘   └──────────┘
                    │              │              │
                    └──────────────┼──────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │  useMetricsTracking Hook │
                    │  ----------------------  │
                    │  • Batches events (10)   │
                    │  • Flushes every 60s     │
                    │  • Handles offline       │
                    │  • Mobile-optimized      │
                    └──────────────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
        ┌──────────────────┐ ┌─────────────┐ ┌──────────────┐
        │ user_metrics_    │ │user_        │ │astra_        │
        │ daily            │ │milestones   │ │performance_  │
        │                  │ │             │ │logs          │
        │ • messages_sent  │ │• first_     │ │• response_   │
        │ • reports_gen    │ │  message    │ │  time_ms     │
        │ • visualizations │ │• first_     │ │• success     │
        │ • sessions       │ │  report     │ │• errors      │
        │ • duration       │ │• first_viz  │ │• mode        │
        └──────────────────┘ └─────────────┘ └──────────────┘
```

---

## 🔄 Message Tracking Flow

```
User Sends Message
       │
       ├─► Add to UI (optimistic update)
       │
       ├─► Send to N8N webhook (AI processing)
       │   └─► Start performance timer
       │
       ├─► AI Response Received
       │   ├─► Calculate response_time_ms
       │   └─► Parse response content
       │
       ├─► Save to Database (astra_chats)
       │   ├─► User message logged
       │   └─► AI response logged
       │
       └─► Track Metrics
           ├─► trackMessageSent(chatId, 'private')
           │   ├─► Queue: { type: 'message', metadata }
           │   └─► Check first_message milestone
           │
           └─► trackAIPerformance({
                 chatId, responseTimeMs, success: true
               })
               └─► Insert into astra_performance_logs

After 10 messages OR 60 seconds:
       │
       └─► Flush Metrics
           └─► increment_daily_metric('messages_sent', 10)
               └─► Updates user_metrics_daily
```

---

## 📈 Report Tracking Flow

```
User Runs Report
       │
       ├─► Show loading state
       │
       ├─► Fetch user/team data
       │
       ├─► Send to N8N webhook
       │   ├─► Include report metadata
       │   └─► mode: 'reports'
       │
       ├─► AI Response Received
       │   └─► Parse report content
       │
       ├─► Save to Database (astra_chats)
       │   ├─► mode: 'reports'
       │   └─► metadata: { reportId, title, etc }
       │
       └─► Track Metrics
           └─► trackReportGeneration(reportId, templateId)
               ├─► Queue: { type: 'report', metadata }
               └─► Check first_report milestone

After 10 reports OR 60 seconds:
       │
       └─► Flush Metrics
           └─► increment_daily_metric('reports_generated', 1)
               └─► Updates user_metrics_daily
```

---

## 🎨 Visualization Tracking Flow

```
User Saves Visualization
       │
       ├─► Open save modal
       │
       ├─► User enters title
       │
       ├─► Save to Database (saved_visualizations)
       │   ├─► chat_message_id
       │   ├─► visualization_data (HTML)
       │   └─► original_prompt
       │
       └─► Track Metrics
           └─► trackVisualizationCreation(chatMessageId)
               ├─► Queue: { type: 'visualization', metadata }
               └─► Check first_visualization milestone

After 10 visualizations OR 60 seconds:
       │
       └─► Flush Metrics
           └─► increment_daily_metric('visualizations_created', 1)
               └─► Updates user_metrics_daily
```

---

## ⏱️ Session Tracking Flow

```
App Opens
       │
       ├─► Check sessionStorage for existing session
       │   └─► If none, start new session
       │
       ├─► trackSessionStart()
       │   ├─► Generate session UUID
       │   ├─► Store in sessionStorage
       │   ├─► Record start timestamp
       │   └─► increment_daily_metric('sessions_count', 1)
       │
       └─► User Activity...

App Closes / Tab Switch / Mobile Background
       │
       ├─► Detect via 'visibilitychange' event
       │
       └─► trackSessionEnd()
           ├─► Calculate duration (now - start)
           ├─► increment_daily_metric('total_session_duration_seconds', duration)
           ├─► Clear sessionStorage
           └─► Flush any pending metrics

App Returns to Foreground
       │
       └─► Check sessionStorage
           └─► If none, start new session (repeat flow)
```

---

## 🔢 Batching Mechanism

```
Event Occurs (message, report, visualization, etc.)
       │
       ├─► queueMetric({ type, metadata })
       │   └─► Add to in-memory queue
       │
       ├─► Check queue size
       │   ├─► If >= 10 events
       │   │   └─► Flush immediately
       │   │
       │   └─► If < 10 events
       │       └─► Set/reset 60-second timer
       │
       └─► Wait for flush trigger...

Flush Triggered (10 events OR 60 seconds OR manual)
       │
       ├─► Copy queue to local array
       │
       ├─► Clear queue
       │
       ├─► Clear timer
       │
       ├─► Aggregate by type
       │   ├─► Count messages
       │   ├─► Count reports
       │   ├─► Count visualizations
       │   └─► Count documents
       │
       └─► Batch Update Database
           ├─► increment_daily_metric('messages_sent', count)
           ├─► increment_daily_metric('reports_generated', count)
           ├─► increment_daily_metric('visualizations_created', count)
           └─► increment_daily_metric('documents_uploaded', count)

If Flush Fails:
       │
       └─► Re-queue events for retry
           └─► Will retry on next flush
```

---

## 🎯 Milestone Tracking Flow

```
First Time Action (message, report, visualization)
       │
       ├─► Check if milestone exists
       │   └─► SELECT FROM user_milestones
       │       WHERE user_id = ? AND milestone_type = ?
       │
       ├─► If NOT found (first time):
       │   └─► INSERT INTO user_milestones
       │       ├─► milestone_type: 'first_message'
       │       ├─► milestone_value: { chatId, mode, timestamp }
       │       └─► achieved_at: now()
       │
       └─► If found (already exists):
           └─► Skip (milestone already recorded)

UNIQUE constraint ensures no duplicates:
    UNIQUE(user_id, milestone_type)
```

---

## ⚡ Performance Logging Flow

```
AI Request Sent
       │
       ├─► Start timer: startTime = Date.now()
       │
       ├─► Send to webhook
       │   └─► Wait for response...
       │
       ├─► Response Received (or Error)
       │   └─► responseTime = Date.now() - startTime
       │
       └─► trackAIPerformance({
             chatId?: string,
             responseTimeMs: number,
             success: boolean,
             errorMessage?: string,
             mode: 'chat' | 'reports' | 'visualization'
           })
           │
           ├─► INSERT INTO astra_performance_logs
           │   ├─► user_id
           │   ├─► chat_id (if available)
           │   ├─► response_time_ms
           │   ├─► success (true/false)
           │   ├─► error_message (if failed)
           │   └─► mode
           │
           └─► If failed:
               └─► increment_daily_metric('error_count', 1)
```

---

## 📱 Mobile Lifecycle Handling

```
┌─────────────────────────────────────────────────┐
│              Mobile App Lifecycle                │
└─────────────────────────────────────────────────┘

App Opened / Foreground
       │
       └─► document.hidden = false
           └─► Check sessionStorage
               ├─► If session exists: Continue session
               └─► If no session: trackSessionStart()

User Switches Apps / Locks Screen
       │
       └─► document.hidden = true
           └─► 'visibilitychange' event fires
               ├─► trackSessionEnd()
               │   ├─► Calculate duration
               │   └─► Update metrics
               │
               └─► flushMetrics()
                   └─► Save any pending events

User Returns to App
       │
       └─► document.hidden = false
           └─► 'visibilitychange' event fires
               └─► Check sessionStorage
                   └─► If no session: trackSessionStart()
                       └─► New session begins
```

---

## 🔐 Data Flow & Security

```
┌──────────────┐
│  Client App  │
│  (Browser)   │
└──────┬───────┘
       │
       │ (Authenticated via Supabase Auth)
       │
       ▼
┌──────────────┐
│  RLS Layer   │◄─── auth.uid() = user_id
└──────┬───────┘
       │
       │ (Only own data visible)
       │
       ▼
┌──────────────────────────────────────┐
│         Database Tables              │
│                                      │
│  ┌────────────────────────────┐    │
│  │ user_metrics_daily         │    │
│  │ ├─ user_id (filtered)      │    │
│  │ ├─ metric_date             │    │
│  │ └─ aggregated_counts       │    │
│  └────────────────────────────┘    │
│                                      │
│  ┌────────────────────────────┐    │
│  │ user_milestones            │    │
│  │ ├─ user_id (filtered)      │    │
│  │ ├─ milestone_type          │    │
│  │ └─ achieved_at             │    │
│  └────────────────────────────┘    │
│                                      │
│  ┌────────────────────────────┐    │
│  │ astra_performance_logs     │    │
│  │ ├─ user_id (filtered)      │    │
│  │ ├─ response_time_ms        │    │
│  │ └─ success/error           │    │
│  └────────────────────────────┘    │
└──────────────────────────────────────┘

Super Admin Access:
  └─► Special RLS policy
      └─► If email IN (clay@, derek@, marshall@)
          └─► Can view ALL user data
```

---

## 🎨 Data Aggregation Example

```
Day 1: User Activity
├─► 09:00 - Sends 5 messages
│   └─► Queue: [msg, msg, msg, msg, msg]
│
├─► 09:05 - Sends 5 more messages
│   └─► Queue: [msg, msg, msg, msg, msg, msg, msg, msg, msg, msg]
│   └─► AUTO-FLUSH (10 events reached)
│       └─► UPDATE user_metrics_daily
│           SET messages_sent = messages_sent + 10
│           WHERE user_id = ? AND metric_date = '2024-11-20'
│
├─► 10:00 - Creates 2 reports
│   └─► Queue: [report, report]
│
├─► 10:30 - Saves 1 visualization
│   └─► Queue: [report, report, viz]
│
└─► 11:00 - (60 seconds since last flush)
    └─► AUTO-FLUSH (timer expired)
        └─► UPDATE user_metrics_daily
            SET reports_generated = reports_generated + 2,
                visualizations_created = visualizations_created + 1
            WHERE user_id = ? AND metric_date = '2024-11-20'

Result in user_metrics_daily:
┌────────────┬──────────────┬───────────────┬───────────────────────┐
│ user_id    │ metric_date  │ messages_sent │ reports_generated     │
├────────────┼──────────────┼───────────────┼───────────────────────┤
│ abc-123... │ 2024-11-20   │ 10            │ 2                     │
└────────────┴──────────────┴───────────────┴───────────────────────┘
```

---

## 🚀 Benefits Visualization

```
Before Metrics Tracking:
┌────────────────────────────────────────┐
│  ❌ No usage insights                  │
│  ❌ Slow dashboard queries             │
│  ❌ No onboarding metrics              │
│  ❌ No performance monitoring          │
│  ❌ Guessing user behavior             │
└────────────────────────────────────────┘

After Metrics Tracking:
┌────────────────────────────────────────┐
│  ✅ Real-time engagement data          │
│  ✅ 10-100x faster queries             │
│  ✅ Time-to-value metrics              │
│  ✅ SLA monitoring enabled             │
│  ✅ Data-driven decisions              │
│  ✅ Churn prediction possible          │
│  ✅ Power user identification          │
│  ✅ Feature adoption tracking          │
└────────────────────────────────────────┘
```

---

## 📊 Sample Dashboard Layout (Future)

```
┌─────────────────────────────────────────────────────────────┐
│                    ASTRA ADMIN DASHBOARD                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │   DAU    │  │   MAU    │  │Messages  │  │ Reports  │  │
│  │   150    │  │   1,240  │  │  3,420   │  │   890    │  │
│  │  +12%    │  │  +23%    │  │  +8%     │  │  +15%    │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Messages Sent (Last 30 Days)                  │  │
│  │                                                        │  │
│  │   200│                                     ╱╲         │  │
│  │   150│                           ╱╲      ╱  ╲        │  │
│  │   100│              ╱╲          ╱  ╲    ╱    ╲       │  │
│  │    50│    ╱╲      ╱  ╲        ╱    ╲  ╱      ╲      │  │
│  │     0└────────────────────────────────────────────   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────┐  ┌─────────────────────────────┐  │
│  │   Top Features     │  │   Avg Response Time (ms)    │  │
│  │                    │  │                              │  │
│  │  • Messages  45%   │  │   Chat:    1,234 ms         │  │
│  │  • Reports   30%   │  │   Reports: 2,456 ms         │  │
│  │  • Visuals   25%   │  │   Viz:     1,890 ms         │  │
│  └────────────────────┘  └─────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Implementation Status

```
✅ Database Tables
   ├─ ✅ user_metrics_daily
   ├─ ✅ user_milestones
   └─ ✅ astra_performance_logs

✅ Database Functions
   └─ ✅ increment_daily_metric()

✅ Frontend Hook
   └─ ✅ useMetricsTracking.ts

✅ Integrations
   ├─ ✅ Chat messages (useChat.ts)
   ├─ ✅ Report generation (useReports.ts)
   └─ ✅ Visualizations (useSavedVisualizations.ts)

✅ Build & Testing
   ├─ ✅ TypeScript compiles
   ├─ ✅ No linting errors
   └─ ✅ Build passes

📋 Documentation
   ├─ ✅ Implementation Summary
   ├─ ✅ Testing Guide
   └─ ✅ Visual Summary (this file)
```

---

**Status:** 🚀 **Ready for Production Use**

All tracking is active and collecting data. Start using the app to see metrics populate in real-time!
