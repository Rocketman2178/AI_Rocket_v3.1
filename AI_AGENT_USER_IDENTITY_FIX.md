# AI Agent User Identity Hallucination Fix

## Problem

The AI Agent node is hallucinating names when formulating search queries.

**Example:**
- **User input:** "From our most recent L10 meeting, please provide a detailed list of action items that **I** need to complete..."
- **User:** Clay Speakman (clay@rockethub.ai)
- **AI Agent search query sent to Vector Meetings:** "action items for **Ryan** from the most recent L10 meeting"

The AI invented "Ryan" - a person who doesn't exist on the team.

## Root Cause

The AI Agent is reformulating user queries when calling tools, but it's not maintaining proper user identity context. The system prompt includes the user's name, but the AI isn't respecting this when generating search queries for tools.

## Solution

Add explicit user identity awareness instructions to the system prompt. Update the **AI Agent node's system message** in the n8n workflow to include:

### Add to System Prompt (insert after "TEAM-BASED DATA ACCESS CONTEXT:")

```
**🚨 CRITICAL USER IDENTITY AWARENESS:**
- **Current User:** {{ $('Enhanced Date Query Preprocessor').item.json.user_name }}
- **User Email:** {{ $('Enhanced Date Query Preprocessor').item.json.user_email }}

**MANDATORY QUERY FORMULATION RULES:**
When users ask about "I", "me", "my", or "our", you MUST:
1. ✅ **PRESERVE the user's actual identity** - This is {{ $('Enhanced Date Query Preprocessor').item.json.user_name }}
2. ✅ **NEVER invent or assume different names** - Don't create fictional people
3. ✅ **Keep pronouns as-is when searching** - "action items for me" should search for "action items" with user context
4. ✅ **Respect the authenticated user** - All queries are scoped to {{ $('Enhanced Date Query Preprocessor').item.json.user_name }}'s data access
5. ✅ **Pass through user intent accurately** - Don't rewrite queries with different subjects

**EXAMPLES OF CORRECT QUERY HANDLING:**

❌ **WRONG:** User asks "What are MY action items from the L10?" → You search: "action items for Ryan"
✅ **CORRECT:** User asks "What are MY action items from the L10?" → You search: "action items L10 meeting" (user context is already filtered)

❌ **WRONG:** User asks "Summarize what I need to focus on" → You search: "summary for John"
✅ **CORRECT:** User asks "Summarize what I need to focus on" → You search: "action items priorities focus areas" (user scoping automatic)

❌ **WRONG:** User asks "Show me OUR team's goals" → You search: "team goals for Marketing"
✅ **CORRECT:** User asks "Show me OUR team's goals" → You search: "team goals strategic objectives" (team_id filter applied)

**WHY THIS MATTERS:**
- Meeting data is already filtered by team_id automatically
- The user asking the question is {{ $('Enhanced Date Query Preprocessor').item.json.user_name }}
- When they say "I" or "me", they mean THEMSELVES, not a random person
- Don't invent names or subjects that don't exist in the query
- Preserve the semantic meaning of the user's actual words

**WHEN FORMULATING SEARCH QUERIES FOR TOOLS:**
- Extract key topics and concepts
- Remove personal pronouns ("I", "me", "my") but DON'T replace them with other names
- Keep the search focused on content, not fictional subjects
- Trust that user/team filtering happens automatically via metadata filters
```

## Implementation Steps

1. Open the n8n workflow: **Astra - Intelligence Agent (bolt)**
2. Navigate to the **AI Agent** node
3. Find the `systemMessage` configuration (line ~73 in JSON)
4. Locate the section **"TEAM-BASED DATA ACCESS CONTEXT:"**
5. **Insert the new section IMMEDIATELY AFTER** the existing user context block
6. Save the workflow
7. Test with the query: "From our most recent L10 meeting, please provide a detailed list of action items that I need to complete or focus on this week."

## Expected Behavior After Fix

**User Query:**
```
"From our most recent L10 meeting, please provide a detailed list of action items that I need to complete..."
```

**AI Agent should send to Vector Meetings:**
```json
{
  "query": "action items L10 meeting priorities deadlines dependencies"
}
```

**NOT:**
```json
{
  "query": "action items for Ryan from the most recent L10 meeting"  // ❌ WRONG
}
```

## Technical Notes

- The AI Agent node uses Gemini 2.5 Pro
- The preprocessor already provides user_name, user_email, team_id context
- Meeting searches are automatically filtered by team_id in the Supabase function
- The AI should preserve semantic meaning without inventing subjects
- User identity is maintained in the session context, not the search query

## Testing Checklist

After implementing the fix, test these scenarios:

- [ ] "What are MY action items?" - Should NOT invent a name
- [ ] "Show me what I need to focus on" - Should preserve "I" context
- [ ] "From OUR recent meeting..." - Should NOT change team reference
- [ ] "Summarize for ME" - Should NOT replace with a random name
- [ ] Verify search queries sent to Vector Meetings don't contain fictional names
- [ ] Confirm results are properly scoped to the authenticated user (Clay Speakman)

## Location in Workflow JSON

File: `workflows/Astra - Intelligence Agent (bolt) (3).json`

The system message is dynamically constructed using n8n expressions around **line 73**.

Insert the new instructions in the concatenated string after:
```javascript
"**SECURITY PROTOCOL:**\n" +
"- Never expose data from other teams\n" +
"..."
```

And before:
```javascript
"**MEETING TYPES FOR THIS TEAM:**\n" +
```
