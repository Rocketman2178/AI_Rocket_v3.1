# What's New Feature Documentation

## Overview

The "What's New" section in the Help Center keeps users informed about the latest features and improvements to Astra Intelligence. This feature provides a comprehensive, version-tracked changelog that users can access anytime.

## Location

Access "What's New" from:
- Help Center (? icon in header)
- "What's New" tab (second tab with Zap icon)

## Features

### Version Tracking
- Each feature/improvement includes a version number (e.g., "1.0.0")
- Chronological ordering with newest features at the top
- Date added for each entry

### Feature Types
1. **New Feature**: Brand new capabilities added to the platform
   - Icon: Orange Sparkles
   - Badge: Orange "New Feature" badge

2. **Improvement**: Enhancements to existing features
   - Icon: Blue TrendingUp
   - Badge: Blue "Improvement" badge

### User Experience
- **Expandable Details**: Click any feature to see full description
- **Latest Badge**: Newest feature marked with "Latest" badge
- **Organized Display**: Clean, scannable list with visual hierarchy
- **Rich Descriptions**: Multi-paragraph descriptions with bullet lists

### Database Structure

**Table: `whats_new`**
```sql
- id (uuid): Primary key
- title (text): Short feature title
- description (text): Detailed feature description
- version (text): Version number (e.g., "1.0.0")
- feature_type (text): "new_feature" or "improvement"
- date_added (date): Release date
- is_published (boolean): Whether to show in What's New
- display_order (integer): Sorting order (higher = newer)
- created_at (timestamptz): Record creation timestamp
- updated_at (timestamptz): Last update timestamp
```

### Security (RLS Policies)
- All authenticated users can view published features
- Only super admins can create/edit/delete entries
- Super admin emails:
  - clay@rockethub.co
  - claytondipani@gmail.com
  - mattpugh22@gmail.com

## Adding New Features

### For Super Admins
New features can be added directly to the database:

```sql
INSERT INTO whats_new (
  title,
  description,
  version,
  feature_type,
  date_added,
  is_published,
  display_order
) VALUES (
  'Feature Title',
  'Detailed description with examples and benefits...',
  '1.1.0',
  'new_feature',
  '2025-11-15',
  true,
  1100  -- Higher number = newer, appears first
);
```

### Description Format
Descriptions support:
- Multiple paragraphs (separated by blank lines)
- Bullet lists (use • at start of line)
- Rich text formatting in markdown style

Example:
```
This is the main description paragraph explaining the feature.

Key benefits include:
• Benefit one with details
• Benefit two with examples
• Benefit three with impact

This feature helps teams work more efficiently by providing...
```

## Display Order System

Features are sorted by `display_order` (descending):
- 1000+: Current version features
- 900-999: Previous major features
- 800-899: Earlier features
- And so on...

**Recommendation**: Increment by 100 for major features, by 10 for minor updates.

## Component Structure

### WhatsNewSection Component
**File**: `src/components/WhatsNewSection.tsx`

**Features**:
- Fetches published features from Supabase
- Displays in chronological order (newest first)
- Expandable/collapsible details
- Feature type badges and icons
- Date formatting with date-fns
- Loading and error states

**Props**: None (self-contained)

### Integration with Help Center
**File**: `src/components/HelpCenter.tsx`

- Added as "What's New" tab between "Quick Start" and "FAQ"
- Orange accent color for the tab
- Zap icon for visual distinction
- Full-width layout with padding

## Design Guidelines

### Visual Elements
- **Colors**:
  - New Features: Orange (#f97316)
  - Improvements: Blue (#3b82f6)
  - Latest Badge: Orange solid background

- **Icons**:
  - New Features: Sparkles icon
  - Improvements: TrendingUp icon
  - Tab: Zap icon

### Typography
- **Title**: Semibold, 14px, white
- **Description**: Regular, 14px, gray-300
- **Badges**: Extra small (12px), respective colors
- **Dates**: 12px, gray-400

### Spacing
- Items: 12px gap between cards
- Card padding: 16px
- Expanded content: Additional 16px padding
- Section margins: 24px

## Mobile Responsiveness

- Tabs scroll horizontally on mobile
- Cards stack vertically
- Touch-friendly expand/collapse
- Optimized text sizing for small screens
- Responsive icon sizing

## Performance Considerations

- Lazy loading: Only loads when Help Center is opened
- Efficient queries: Filters for `is_published = true`
- Indexed sorting: Uses `display_order` index
- Minimal re-renders: Expand state tracked in Set

## Future Enhancements

Potential improvements:
1. **Search/Filter**: Filter by feature type or date range
2. **Changelog Export**: Export as PDF or markdown
3. **RSS Feed**: Subscribe to updates
4. **Email Notifications**: Alert users about new features
5. **Feature Voting**: Let users vote on feature requests
6. **Tags**: Categorize features by area (UI, AI, Performance, etc.)
7. **Screenshots**: Add visual examples of features
8. **Version Comparison**: Compare features between versions

## Maintenance

### Updating Features
To edit existing features:
```sql
UPDATE whats_new
SET
  description = 'Updated description...',
  updated_at = now()
WHERE id = 'feature-uuid';
```

### Unpublishing Features
To hide features without deleting:
```sql
UPDATE whats_new
SET is_published = false
WHERE id = 'feature-uuid';
```

### Reordering Features
Adjust display_order to change position:
```sql
UPDATE whats_new
SET display_order = 950
WHERE id = 'feature-uuid';
```

## Best Practices

1. **Clear Titles**: Use action-oriented, descriptive titles
2. **Detailed Descriptions**: Explain what, why, and how
3. **Consistent Format**: Follow established description patterns
4. **Regular Updates**: Add features shortly after release
5. **Version Accuracy**: Match version numbers to actual releases
6. **User Benefits**: Focus on value to users, not technical details
7. **Visual Examples**: Describe UI elements users will see
8. **Chronological Order**: Maintain proper ordering via display_order

## Related Documentation

- User Onboarding: `USER_ONBOARDING_GUIDE.md`
- Help System: `src/components/HelpCenter.tsx`
- Documentation Context: `src/lib/documentation-context.ts`

## Help Assistant Integration

The "What's New" content is not directly integrated into the help assistant context, but users can ask questions about features in the "Ask Astra" tab, and Astra will reference the comprehensive documentation context which includes feature explanations.

## Example Entry

```sql
INSERT INTO whats_new (
  title,
  description,
  version,
  feature_type,
  date_added,
  is_published,
  display_order
) VALUES (
  'Astra Guided Setup for Google Drive',
  'Introducing Astra Guided Setup! When connecting Google Drive folders, Astra now walks you through each folder type (Strategy, Meetings, Financial) with helpful examples and sample prompts.

• Step-by-step guidance with examples
• Sample prompts for each data type
• Best practices and tips
• Save & Continue Later functionality
• Progress tracking

This guided experience helps teams understand the value of each data type and ensures proper folder configuration.',
  '1.0.0',
  'new_feature',
  '2025-11-15',
  true,
  1000
);
```

---

## Recent Features to Add

### November 2025 Updates

The following features have been recently implemented and should be added to the What's New section:

#### 1. Enhanced Error Handling (v1.1.1)
**Type:** Improvement
**Description:**
Astra now provides clear, user-friendly error messages when unable to generate responses. Instead of technical errors, you'll see helpful suggestions:

• What went wrong in plain English
• Specific steps you can try to resolve the issue
• When to contact support for help

This applies to network errors, timeouts, empty responses, and server errors in both Private and Team Chat modes.

**Display Order:** 1110

#### 2. Balanced Data Category Usage in Guided Chat (v1.1.0)
**Type:** Improvement
**Description:**
Astra Guided Chat now ensures balanced use of all your data types. When you have strategy documents, meeting notes, AND financial records, all three suggested prompts will reference multiple data categories:

• Prompt 1: Strategy + Meetings alignment
• Prompt 2: Financials + Strategy insights
• Prompt 3: Cross-functional analysis (all 3 types)

This ensures comprehensive insights across your entire business data.

**Display Order:** 1105

#### 3. Meetings Data Display Fix (v1.1.0)
**Type:** Improvement
**Description:**
Fixed an issue where meeting documents weren't appearing during Astra Guided Chat prompt generation. Now all 123+ meeting documents are properly detected and used in personalized prompt suggestions.

**Display Order:** 1100

---

## Summary

The "What's New" feature provides a professional, user-friendly way to keep the team informed about platform updates. It's easily accessible, well-organized, and designed to highlight the continuous improvement of Astra Intelligence.

### Quick Add SQL Snippets

**Enhanced Error Handling:**
```sql
INSERT INTO whats_new (
  title,
  description,
  version,
  feature_type,
  date_added,
  is_published,
  display_order
) VALUES (
  'Enhanced Error Handling',
  'Astra now provides clear, user-friendly error messages when unable to generate responses. Instead of technical errors, you''ll see helpful suggestions:

• What went wrong in plain English
• Specific steps you can try to resolve the issue
• When to contact support for help

This applies to network errors, timeouts, empty responses, and server errors in both Private and Team Chat modes.',
  '1.1.1',
  'improvement',
  '2025-11-29',
  true,
  1110
);
```

**Balanced Data Usage:**
```sql
INSERT INTO whats_new (
  title,
  description,
  version,
  feature_type,
  date_added,
  is_published,
  display_order
) VALUES (
  'Balanced Data Category Usage in Guided Chat',
  'Astra Guided Chat now ensures balanced use of all your data types. When you have strategy documents, meeting notes, AND financial records, all three suggested prompts will reference multiple data categories:

• Prompt 1: Strategy + Meetings alignment
• Prompt 2: Financials + Strategy insights
• Prompt 3: Cross-functional analysis (all 3 types)

This ensures comprehensive insights across your entire business data.',
  '1.1.0',
  'improvement',
  '2025-11-29',
  true,
  1105
);
```

**Meetings Data Fix:**
```sql
INSERT INTO whats_new (
  title,
  description,
  version,
  feature_type,
  date_added,
  is_published,
  display_order
) VALUES (
  'Meetings Data Display Fix',
  'Fixed an issue where meeting documents weren''t appearing during Astra Guided Chat prompt generation. Now all your meeting documents are properly detected and used in personalized prompt suggestions.',
  '1.1.0',
  'improvement',
  '2025-11-29',
  true,
  1100
);
```
