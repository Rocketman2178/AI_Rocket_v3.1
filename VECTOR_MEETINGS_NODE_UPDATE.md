# N8N Workflow: Supabase Vector Meetings Node Update

## Your Current Configuration

```javascript
// Current queryName (SMART conditional logic):
{{ $('Enhanced Date Query Preprocessor').item.json.strictModeEnabled
   ? 'match_documents_single_category'
   : 'match_documents_filtered_recency_weighted_fast' }}
```

**This conditional logic is excellent because:**
- **Strict Mode** → Uses single-category search (for specific meeting types)
- **General Mode** → Uses multi-category search (for broad queries)

**✅ KEEP THIS LOGIC!** Just update the function names.

---

## ⭐ Recommended Update

### **Update the queryName to:**

```javascript
{{ $('Enhanced Date Query Preprocessor').item.json.strictModeEnabled
   ? 'match_documents_single_category_progressive'
   : 'match_documents_meetings_progressive' }}
```

### **What Changed:**
- `match_documents_single_category` → `match_documents_single_category_progressive`
- `match_documents_filtered_recency_weighted_fast` → `match_documents_meetings_progressive`

### **What Stays the Same:**
- ✅ All parameters (match_team_id, match_category, recency_weight, max_days_old)
- ✅ Return schema (id, content, metadata, similarity)
- ✅ Conditional logic (strictModeEnabled check)
- ✅ All features (recency weighting, hybrid scoring)

---

## Why This Update

### **Problem:**
- Broad queries like "recent activities" search 14,000+ chunks → timeout
- Users see error, get nothing

### **Solution:**
- New functions add progressive fallback
- Try full range first, fall back to narrower ranges if needed
- Users ALWAYS get results

### **Behavior:**

**Strict Mode (Specific Meeting Type):**
```
User: "What happened in L10 meetings?"
→ strictModeEnabled = true
→ Uses: match_documents_single_category_progressive
→ Searches: Only L10 category (small dataset)
→ Result: Fast, rarely needs fallback
```

**General Mode (Broad Query):**
```
User: "Summarize recent activities"
→ strictModeEnabled = false
→ Uses: match_documents_meetings_progressive
→ Searches: All categories (large dataset)
→ Result: Uses fallback if needed, always returns results
```

---

## Complete Node Configuration

```javascript
{
  "parameters": {
    "operation": "search",
    "tableName": "document_chunks_meetings",
    "options": {
      "queryName": "={{ $('Enhanced Date Query Preprocessor').item.json.strictModeEnabled ? 'match_documents_single_category_progressive' : 'match_documents_meetings_progressive' }}",
      "metadata": {
        "metadataValues": [
          {
            "name": "filter",
            "value": "={{ {
              match_team_id: $('Enhanced Date Query Preprocessor').item.json.team_id,
              match_category: $('Enhanced Date Query Preprocessor').item.json.meetingTypes?.[0] || '',
              recency_weight: $('Enhanced Date Query Preprocessor').item.json.metadataFilterJson.recencyWeight,
              max_days_old: $('Enhanced Date Query Preprocessor').item.json.metadataFilterJson.maxDaysOld
            } }}"
          }
        ]
      }
    }
  }
}
```

---

## Testing

**After update, test both modes:**

### Test 1: Strict Mode
```
Query: "What happened in L10 meetings this quarter?"
Expected: Fast results (< 20s), likely Attempt 1 success
```

### Test 2: General Mode
```
Query: "Summarize our recent activities"
Expected: Results in 10-30s, may use fallback
```

---

## Summary

**Change Required:** Update queryName in the "Supabase Vector Meetings" node

**From:**
```javascript
strictModeEnabled ? 'match_documents_single_category'
                  : 'match_documents_filtered_recency_weighted_fast'
```

**To:**
```javascript
strictModeEnabled ? 'match_documents_single_category_progressive'
                  : 'match_documents_meetings_progressive'
```

**Result:** Both query modes now have fallback protection. Users never see timeout errors! 🚀
