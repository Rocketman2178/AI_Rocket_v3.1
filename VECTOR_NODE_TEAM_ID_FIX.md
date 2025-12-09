# Vector Node Team ID Filter Fix

## Problem
The Vector Meetings and Vector Strategy nodes are failing with this error:
```
Error searching for documents: P0001 Missing required parameter: team_id (filter contains: {"filter": "[object Object]", "match_count": 14040}) null
```

## Root Cause
The **Metadata Filter Value** field in the Supabase Vector Store nodes is being set to a JavaScript expression that returns an object reference instead of the actual UUID string value.

### Current (BROKEN) Configuration

**In Vector Meetings Node:**
- **Metadata Filter Name**: `team_id`
- **Metadata Filter Value**: `{{ $('Enhanced Date Query Preprocessor').item.json.team_id }}`

**In Vector Strategy Node:**
- **Metadata Filter Name**: `team_id`
- **Metadata Filter Value**: `{{ $('Enhanced Date Query Preprocessor').item.json.team_id }}`

### Why It Fails
When n8n evaluates `{{ $('Enhanced Date Query Preprocessor').item.json.team_id }}`, it sometimes returns the object reference path as a string `"[object Object]"` instead of evaluating it to the actual UUID value.

## Solution

The fix depends on n8n's evaluation context. Try these solutions in order:

### Solution 1: Remove Outer Braces (Preferred)
Change the **Metadata Filter Value** from:
```
{{ $('Enhanced Date Query Preprocessor').item.json.team_id }}
```

To (without outer braces):
```
$('Enhanced Date Query Preprocessor').item.json.team_id
```

**OR** use the alternative drag-and-drop reference:
```
={{ $json.team_id }}
```
(If the Enhanced Date Query Preprocessor data is directly accessible)

### Solution 2: Force String Conversion
If Solution 1 doesn't work, explicitly convert to string:
```
={{ String($('Enhanced Date Query Preprocessor').item.json.team_id) }}
```

### Solution 3: Use .toString() Method
```
={{ $('Enhanced Date Query Preprocessor').item.json.team_id.toString() }}
```

## Step-by-Step Fix Instructions

### For **Supabase Vector Meetings** Node:

1. Open the workflow in n8n
2. Click on the **"Supabase Vector Meetings"** node
3. Scroll to **Options** section
4. Find **Metadata Filter** (should see `Name: filter`, `Value: [object Object]`)
5. Click to expand the filter configuration
6. Locate the filter with **Name** = `team_id`
7. Change the **Value** field to one of:
   - `$('Enhanced Date Query Preprocessor').item.json.team_id` (no braces)
   - `={{ String($('Enhanced Date Query Preprocessor').item.json.team_id) }}`
8. **Save** the node

### For **Supabase Vector Strategy Documents** Node:

1. Click on the **"Supabase Vector Strategy Documents"** node
2. Scroll to **Options** section
3. Find **Metadata Filter**
4. Locate the filter with **Name** = `team_id`
5. Change the **Value** field using the same approach as above
6. **Save** the node

### For **Supabase Vector Financials** Node (if applicable):

Apply the same fix as above to ensure consistency across all vector search nodes.

## Additional Filters to Check

While fixing `team_id`, also verify these other filters don't have the same issue:

### In Vector Meetings Node:
Check the complex filter Value field:
```javascript
{{ {
  match_category: $('Enhanced Date Query Preprocessor').item.json.meetingTypes && $('Enhanced Date Query Preprocessor').item.json.meetingTypes.length > 0 ? $('Enhanced Date Query Preprocessor').item.json.meetingTypes[0] : '',
  match_team_id: $('Enhanced Date Query Preprocessor').item.json.team_id,
  recency_weight: $('Enhanced Date Query Preprocessor').item.json.metadataFilterJson.recencyWeight,
  max_days_old: $('Enhanced Date Query Preprocessor').item.json.metadataFilterJson.maxDaysOld
} }}
```

This entire object might be the issue. The Supabase Vector Store node may expect **individual filter entries**, not a complex object.

### Recommended Approach: Use Multiple Individual Filters

Instead of passing a complex object, create **separate filter entries**:

**Filter 1:**
- Name: `team_id`
- Value: `$('Enhanced Date Query Preprocessor').item.json.team_id`

**Filter 2** (if meeting category is needed):
- Name: `match_category`
- Value: `={{ $('Enhanced Date Query Preprocessor').item.json.meetingTypes && $('Enhanced Date Query Preprocessor').item.json.meetingTypes.length > 0 ? $('Enhanced Date Query Preprocessor').item.json.meetingTypes[0] : '' }}`

**Filter 3** (if recency weight is needed):
- Name: `recency_weight`
- Value: `={{ $('Enhanced Date Query Preprocessor').item.json.metadataFilterJson.recencyWeight }}`

**Filter 4** (if max days old is needed):
- Name: `max_days_old`
- Value: `={{ $('Enhanced Date Query Preprocessor').item.json.metadataFilterJson.maxDaysOld }}`

## Testing the Fix

After making changes:

1. **Save** the workflow
2. **Execute** the workflow manually with this test payload:
```json
{
  "chatInput": "Summarize our mission, core values, and goals",
  "user_id": "d7fa4222-6c99-41b7-9f37-a35dbe8f4fbb",
  "user_email": "terry.j.zannella@gmail.com",
  "user_name": "Terry Zannella",
  "conversation_id": "fc91314f-d791-49a4-b5bc-23851dc90dae",
  "team_id": "f7fb12cb-05d9-40be-842d-785888f6519e",
  "team_name": "Hydra Maxx",
  "role": "admin",
  "view_financial": true,
  "mode": "private"
}
```

3. **Check** the Vector node outputs - should now show actual documents instead of errors

4. **Verify** the error no longer mentions `"[object Object]"`

## Verification Query

To confirm the team has documents in the database, run this:

```sql
-- Check document_chunks_meetings
SELECT team_id, COUNT(*) as chunk_count
FROM document_chunks_meetings
WHERE team_id = 'f7fb12cb-05d9-40be-842d-785888f6519e'
GROUP BY team_id;

-- Check document_chunks_strategy
SELECT team_id, COUNT(*) as chunk_count
FROM document_chunks_strategy
WHERE team_id = 'f7fb12cb-05d9-40be-842d-785888f6519e'
GROUP BY team_id;
```

Expected result: Should show hundreds or thousands of chunks for this team.

## Root Cause Summary

The n8n Supabase Vector Store node's **Metadata Filter** feature expects:
- **Simple string values** for filter parameters
- **Individual filter entries** rather than complex objects
- **Proper type coercion** from expressions to primitive values

When passing `{{ $(...).team_id }}`, n8n's expression evaluator was returning the object reference itself as a string (`"[object Object]"`) instead of extracting the UUID value.

## Prevention

Going forward, when adding metadata filters to Supabase Vector Store nodes:
1. Always use expressions **without outer braces** when referencing simple values
2. Use `String()` wrapper if type coercion is unclear
3. Create separate filter entries rather than complex nested objects
4. Test with actual data immediately after configuration

---

**Status**: Fix documented
**Priority**: HIGH - Blocks all vector search functionality
**Impact**: Affects Vector Meetings, Vector Strategy, and potentially Vector Financials nodes
**Applies to**: Workflow "Astra - Intelligence Agent (26).json"
