# Meeting Search Functions - Visual Guide

## Quick Visual Comparison

```
┌─────────────────────────────────────────────────────────────────┐
│                    MEETING SEARCH FUNCTIONS                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PROGRESSIVE          MEDIUM_RECALL         BALANCED             │
│  ⚡⚡⚡ Speed           ⚡⚡ Speed             ⚡ Speed              │
│  📊 Recall            📊📊 Recall           📊📊📊 Recall         │
│                                                                  │
│  ┌─────────┐         ┌─────────────┐       ┌──────────────────┐│
│  │60 days  │         │120 days     │       │180 days (full)   ││
│  │400 docs │         │8,000 docs   │       │30,000 docs       ││
│  │0.50 sim │         │0.45 sim     │       │0.50 sim          ││
│  └─────────┘         └─────────────┘       └──────────────────┘│
│       ↓                    ↓                       ↓            │
│  2-3 meetings         5-10 meetings          10-20+ meetings    │
│  10-15 seconds        20-30 seconds          30-60 seconds      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Timeline Coverage Visualization

```
Current Date: Nov 17, 2025

                    ←───────── Looking Back in Time ─────────→

Progressive:        |████████████████| (60 days)
                    Oct 18 ────────── Nov 17

Medium-Recall:      |████████████████████████████████| (120 days)
                    Jul 20 ─────────────────────────── Nov 17

Balanced:           |████████████████████████████████████████████| (180 days)
                    May 21 ─────────────────────────────────────── Nov 17
```

---

## Results Volume Comparison

For a query like: "action items from recent L10 meetings"

```
PROGRESSIVE (Current - Too Few)
═══════════════════════════════
Meeting 1: Nov 15, 2025 ████████████████ (150 chunks)
Meeting 2: Nov 8, 2025  ████████████████ (145 chunks)
Meeting 3: Nov 1, 2025  ████████████████ (148 chunks)
────────────────────────────────────────
Total: ~450 chunks from 3 meetings
✗ Missing: Oct 25, Oct 18, Oct 11, Oct 4...


MEDIUM_RECALL (Recommended - Just Right)
═════════════════════════════════════════
Meeting 1: Nov 15, 2025 ████████████████ (150 chunks)
Meeting 2: Nov 8, 2025  ████████████████ (145 chunks)
Meeting 3: Nov 1, 2025  ████████████████ (148 chunks)
Meeting 4: Oct 25, 2025 ████████████████ (152 chunks)
Meeting 5: Oct 18, 2025 ████████████████ (140 chunks)
Meeting 6: Oct 11, 2025 ████████████████ (155 chunks)
Meeting 7: Oct 4, 2025  ████████████████ (147 chunks)
Meeting 8: Sep 27, 2025 ████████████████ (143 chunks)
Meeting 9: Sep 20, 2025 ████████████████ (138 chunks)
────────────────────────────────────────
Total: ~1,300 chunks from 9 meetings
✓ Good coverage of "recent" period


BALANCED (Maximum - Comprehensive)
═══════════════════════════════════
Meeting 1-9: (same as above)
Meeting 10: Sep 13, 2025 ████████████████
Meeting 11: Sep 6, 2025  ████████████████
Meeting 12: Aug 30, 2025 ████████████████
Meeting 13: Aug 23, 2025 ████████████████
Meeting 14: Aug 16, 2025 ████████████████
Meeting 15: Aug 9, 2025  ████████████████
... (continues back to May)
────────────────────────────────────────
Total: ~2,500+ chunks from 20+ meetings
⚠ May timeout, slower response
```

---

## Performance Graph

```
Execution Time vs Meetings Returned

Seconds │
  60s ──┤                                      ● Balanced
        │                                    ╱
  50s ──┤                                  ╱
        │                                ╱
  40s ──┤                              ╱
        │                            ╱
  30s ──┤                       ● Medium
        │                     ╱
  20s ──┤                   ╱
        │                 ╱
  10s ──┤         ● Progressive
        │       ╱
   0s ──┼──────┴─────┴─────┴─────┴─────┴─────┴───
        0      3      6      9     12    15    18+
                     Number of Meetings
```

---

## Decision Flowchart

```
                    ┌──────────────────────┐
                    │  User Query          │
                    └──────────┬───────────┘
                               │
                ┌──────────────┴──────────────┐
                │                              │
        Contains "most recent"         Contains "recent"
        or "latest" (singular)?        (plural/timeframe)?
                │                              │
                ↓                              ↓
        ┌───────────────┐            ┌──────────────────┐
        │  PROGRESSIVE  │            │  MEDIUM_RECALL   │
        │               │            │                  │
        │ ⚡⚡⚡ 10-15s │            │ ⚡⚡ 20-30s      │
        │ 2-3 meetings  │            │ 5-10 meetings    │
        └───────────────┘            └──────────────────┘
                                               │
                                     ┌─────────┴─────────┐
                                     │                    │
                              Need everything?    No, "recent"
                              (historical query)    is enough
                                     │                    │
                                     ↓                    ↓
                            ┌─────────────────┐  ┌──────────────────┐
                            │   BALANCED      │  │  MEDIUM_RECALL   │
                            │                 │  │                  │
                            │ ⚡ 30-60s      │  │ ⚡⚡ 20-30s      │
                            │ 10-20+ meetings │  │ 5-10 meetings    │
                            └─────────────────┘  └──────────────────┘
```

---

## Your Current Issue - Visual Diagnosis

### BEFORE (Using Progressive)

```
User Query: "action items from recent L10 meetings"
                    ↓
           [Progressive Function]
                    ↓
         Search Window: 60 days
         Document Limit: 400
         Similarity: 0.50 (high)
                    ↓
    ┌─────────────────────────────┐
    │ Results: 2-3 meetings       │ ← TOO FEW!
    │ - Nov 15, 2025              │
    │ - Nov 8, 2025               │
    │ - Nov 1, 2025               │
    └─────────────────────────────┘
         Missing: Oct 25, Oct 18,
         Oct 11, Oct 4, Sep 27...
```

### AFTER (Using Medium-Recall)

```
User Query: "action items from recent L10 meetings"
                    ↓
        [Medium-Recall Function]
                    ↓
         Search Window: 120 days
         Document Limit: 8,000
         Similarity: 0.45 (lower)
                    ↓
    ┌─────────────────────────────┐
    │ Results: 8-10 meetings      │ ← MUCH BETTER!
    │ - Nov 15, 2025              │
    │ - Nov 8, 2025               │
    │ - Nov 1, 2025               │
    │ - Oct 25, 2025              │
    │ - Oct 18, 2025              │
    │ - Oct 11, 2025              │
    │ - Oct 4, 2025               │
    │ - Sep 27, 2025              │
    │ - Sep 20, 2025              │
    └─────────────────────────────┘
         Covers 3+ months of
         "recent" context
```

---

## Similarity Threshold Impact

Lower threshold = More results (better recall)

```
Similarity    Results
Threshold     Returned

  1.00 ──┤   Perfect match only (0 results)
         │
  0.75 ──┤   Very close match (1-2 results)
         │
  0.65 ──┤   ● Progressive Attempt 3 (conservative)
         │
  0.60 ──┤   ● Progressive Attempt 2
         │
  0.55 ──┤   ● Medium-Recall Attempt 3
         │
  0.50 ──┤   ● Progressive Attempt 1
         │   ● Medium-Recall Attempt 2
         │   ● Balanced
  0.45 ──┤   ● Medium-Recall Attempt 1 ← Better recall!
         │
  0.40 ──┤   Too many false positives
         │
  0.00 ──┴───────────────────────────────
         Returns everything (noise)
```

**Key insight:** Medium-Recall starts at 0.45 similarity, catching more relevant content that Progressive misses with its 0.50-0.65 thresholds.

---

## Implementation Checklist

- [ ] Open n8n workflow: "Astra - Intelligence Agent (bolt)"
- [ ] Find node: "Supabase Vector Meetings"
- [ ] Change Query Name from: `match_documents_meetings_progressive`
- [ ] Change Query Name to: `match_documents_meetings_medium_recall`
- [ ] Keep Limit at: 540 (or increase to 800 for more chunks)
- [ ] Save workflow
- [ ] Test with query: "action items from recent L10 meetings"
- [ ] Verify: Should now see 5-10 meetings instead of 2-3
- [ ] Monitor execution time: Should be 20-30 seconds

---

## Expected Improvements

| Metric | Before (Progressive) | After (Medium-Recall) | Improvement |
|--------|----------------------|----------------------|-------------|
| Meetings returned | 2-3 | 5-10 | **3-5x more** |
| Time window | 60 days | 120 days | **2x longer** |
| Chunks returned | ~450 | ~1,300 | **3x more context** |
| Execution time | 10-15s | 20-30s | 15s slower (acceptable) |
| Timeout risk | Never | Rare | Still very safe |
| User satisfaction | ❌ "Too few results" | ✅ "Good coverage" | Much better |

---

## When to Use Each Function - Summary

### Progressive ⚡⚡⚡
**Use when:** "Show me the **MOST RECENT** meeting"
- Single latest item
- Speed is critical
- Don't need historical context

### Medium-Recall ⚡⚡ 📊📊 ✅
**Use when:** "Show me **RECENT** meetings" (YOUR CASE)
- Need 3+ months context
- Want 5-10 meetings
- Balanced speed and recall

### Balanced ⚡ 📊📊📊
**Use when:** "Show me **ALL** meetings about X"
- Need complete history
- Comprehensive research
- Can wait 30-60 seconds

---

**Bottom line:** Switch to `medium_recall` for your "recent action items" queries!
