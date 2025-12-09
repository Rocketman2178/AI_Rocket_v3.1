# Gemini Model Standard

## Critical: Standard Model Configuration

**ALL Gemini API calls in this application MUST use `gemini-flash-latest`**

This is a non-negotiable standard unless explicitly changed by project leadership.

## Rationale

- `gemini-flash-latest` is Google's auto-updating alias that always points to the latest Flash model version
- Ensures consistent performance across all AI features
- Automatically benefits from Google's model improvements
- Maintains uniform behavior for users across different features

## Where This Applies

This standard applies to ALL Gemini API calls including:

1. **Visualizations** - All chart and dashboard generation (including report visualizations)
2. **Ask Astra** - Main chat interactions
3. **Team Chat Summaries** - Activity summarization
4. **Help Assistant** - User support interactions
5. **Metrics Assistant** - User metrics analysis and insights
6. **Any future AI features** - Unless explicitly specified otherwise

### Important: Reports Architecture

**Reports use a hybrid approach:**
- **Report Generation**: Calls n8n webhook workflow (NOT Gemini directly)
- **Report Visualization**: Uses Gemini (`gemini-flash-latest`) to create visual dashboards from the report data

The n8n workflow handles the actual report generation logic. Gemini is only used client-side to generate the interactive HTML visualization from the report text.

## Implementation Pattern

```typescript
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
  model: 'gemini-flash-latest',  // ✅ ALWAYS USE THIS
  generationConfig: {
    // Configure as needed per feature
    temperature: 1.0,
    topK: 64,
    topP: 0.95,
    maxOutputTokens: 100000,
  }
});
```

## ❌ Do NOT Use

- `gemini-1.5-flash` - Hardcoded version
- `gemini-1.5-flash-latest` - Incorrect alias format
- `gemini-pro` - Different model family
- Any other model names unless explicitly approved

## Files Using Gemini

Current files that must maintain this standard:

- `src/hooks/useVisualization.ts` - Visualization generation (for chats AND reports)
- `src/components/GroupChat.tsx` - Team chat summaries
- `src/lib/help-assistant.ts` - Help/support features
- `src/lib/metrics-assistant.ts` - Metrics analysis and insights
- Any future components that integrate Gemini

**Note:** n8n workflows handle their own AI logic and are configured separately in the workflow definitions.

## Verification Checklist

When reviewing code or adding new AI features:

- [ ] Verify `model: 'gemini-flash-latest'` is used
- [ ] Check no hardcoded version numbers
- [ ] Ensure consistent model across all features
- [ ] Update this document if new files are added

## Exception Process

If a different model is required:

1. Must be explicitly approved by Clay (clay@rockethub.ai)
2. Document the reason in code comments
3. Update this file with the exception and rationale
4. Use feature flags if testing alternative models

---

**Last Updated:** November 20, 2025
**Current Standard:** `gemini-flash-latest`
**Status:** ACTIVE - All features must comply
