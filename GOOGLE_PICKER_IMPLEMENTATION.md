# Google Picker API Implementation

## Overview
Implemented Google Picker API as an alternative to the restricted OAuth scope (`drive.metadata.readonly`) for folder selection. This allows users to select folders via Google's native picker interface instead of listing all folders via API.

## Implementation Strategy

### Phased Rollout with Feature Flags
- **Phase 1**: Beta testing with `clay@rockethub.ai` and `clayspeakman@gmail.com`
- **Phase 2**: Gradual rollout to more users
- **Phase 3**: Full migration and removal of restricted scope

### Architecture

#### 1. Feature Flag System
**Files**:
- `supabase/migrations/[timestamp]_add_google_picker_feature_flag.sql`
- `supabase/migrations/20251126160309_add_email_based_feature_flags.sql`

- Created `feature_flags` table with RLS policies
- Supports both user_id-based flags (for existing users) and email-based flags (for pre-signup users)
- Email-based flags automatically migrate to user_id flags when user signs up
- Enabled Google Picker for `clay@rockethub.ai` and `clayspeakman@gmail.com`
- Super admins can manage feature flags for other users

#### 2. Feature Flag Hook
**File**: `src/hooks/useFeatureFlag.ts`
- React hook to check if feature is enabled for current user
- Checks both user_id and email matches (supports pre-signup feature flags)
- Returns `false` during loading to prevent flashing
- Handles errors gracefully

#### 3. Google Picker Component
**File**: `src/components/GoogleDriveFolderPicker.tsx`
- New component using Google Picker API
- Loads Google Picker script dynamically
- Matches existing UI design patterns
- Props interface:
  ```typescript
  interface GoogleDriveFolderPickerProps {
    accessToken: string;
    folderType: 'meetings' | 'strategy' | 'financial';
    currentFolder?: { id: string; name: string } | null;
    onFolderSelected: (folder: { id: string; name: string }) => void;
    onCreateNew?: () => void;
    allowCreateNew?: boolean;
  }
  ```

#### 4. Folder Selection Wrapper
**File**: `src/components/FolderSelectionWrapper.tsx`
- Wrapper component for conditional rendering
- Shows **Google Picker** for beta users with feature flag enabled
- Shows **legacy dropdown** for regular users
- Maintains exact same props interface as legacy implementation
- Zero changes needed in consuming components

#### 5. Integration
**File**: `src/components/GoogleDriveSettings.tsx`
- Updated manual folder selection modal
- Replaced three separate folder selection blocks with `FolderSelectionWrapper`
- One wrapper each for: strategy, meetings, and financial folders

## Key Benefits

### 1. OAuth Scope Compliance
- **Eliminates restricted scope**: No longer needs `drive.metadata.readonly`
- **Only requires**: `drive.file` and `drive.metadata` (non-restricted scopes)
- **Higher approval certainty**: Google prefers Picker API over listing all folders

### 2. Zero Impact on n8n Workflow
- n8n workflow only reads folder IDs from database
- Folder selection method doesn't matter to n8n
- Workflow file: `workflows/Astra - Multi-Team Data Sync Agent (G3) (1).json`

### 3. Seamless User Experience
- UI remains consistent with existing design
- Beta users see Google's native picker
- Regular users see familiar dropdown
- No breaking changes

## Email-Based Feature Flags

### How It Works
The feature flag system supports **two types of flags**:

1. **User ID-based flags**: For existing users already in the database
2. **Email-based flags**: For users who haven't signed up yet

### Pre-Signup Feature Enablement
You can enable features for users **before they sign up**:

```sql
INSERT INTO feature_flags (email, feature_name, enabled)
VALUES ('new-user@example.com', 'google_picker_folder_selection', true);
```

### Automatic Migration on Signup
When a user signs up with that email:
1. Their email-based feature flags are automatically migrated to user_id-based flags
2. The old email-based flags are deleted
3. The user immediately has access to the enabled features

### Benefits
- Test onboarding experience with new features enabled
- Enable features for invited users before they create accounts
- Seamless transition from email-based to user_id-based flags

## Testing Plan

### Phase 1: Beta User Testing

**Testing with existing user (clay@rockethub.ai)**:
1. Log in as `clay@rockethub.ai`
2. Navigate to User Settings → Google Drive
3. Click "Select Existing Folders"
4. Verify Google Picker modal appears
5. Select a folder via Picker
6. Confirm folder saves correctly to database
7. Verify n8n workflow reads folder correctly

**Testing onboarding (clayspeakman@gmail.com)**:
1. Sign up with `clayspeakman@gmail.com`
2. Go through Guided Setup
3. When reaching folder selection step, verify Google Picker appears
4. Test folder selection through Picker during onboarding
5. Complete setup and verify folders are properly connected

### Phase 2: Gradual Rollout
1. Monitor beta user feedback
2. Enable for additional test users
3. Collect performance metrics
4. Fix any issues before broader rollout

### Phase 3: Full Migration
1. Enable feature flag for all users
2. Monitor for 2-4 weeks
3. Remove legacy dropdown code
4. Update OAuth configuration to remove restricted scope

## When to Remove Restricted Scope

**DO NOT** remove `drive.metadata.readonly` scope until:
1. ✅ All users have feature flag enabled
2. ✅ Monitored successfully for 2-4 weeks
3. ✅ Zero reported issues with Picker
4. ✅ Confirmed n8n workflows unaffected

**Then**: Update OAuth consent screen to remove restricted scope

## Files Modified

### New Files
- `src/hooks/useFeatureFlag.ts`
- `src/components/GoogleDriveFolderPicker.tsx`
- `src/components/FolderSelectionWrapper.tsx`
- `supabase/migrations/[timestamp]_add_google_picker_feature_flag.sql`
- `supabase/migrations/20251126160309_add_email_based_feature_flags.sql`

### Modified Files
- `src/components/GoogleDriveSettings.tsx`
  - Added import for `FolderSelectionWrapper`
  - Replaced manual folder selection logic (lines 1088-1241)
  - Now uses wrapper component for all three folder types

## Technical Notes

### Google Picker API Script Loading
- Script loaded dynamically on component mount
- Only loaded once (not removed on unmount)
- Checked before opening picker to prevent errors

### Feature Flag Check
- Runs on every component mount
- Defaults to `false` during loading
- Prevents UI flashing by not rendering until check complete

### Folder Selection Props
The wrapper maintains exact same interface as legacy:
```typescript
interface FolderSelectionWrapperProps {
  accessToken: string;
  folderType: 'meetings' | 'strategy' | 'financial';
  folders: FolderInfo[];  // Only used in legacy mode
  currentFolder: FolderInfo | null;
  searchTerm: string;     // Only used in legacy mode
  onSearchChange: (term: string) => void;  // Only used in legacy mode
  onFolderSelect: (folder: FolderInfo | null) => void;
  onCreateNew?: () => void;
  allowCreateNew?: boolean;
}
```

## Next Steps

1. **Test with clay@rockethub.ai account**
   - Verify Google Picker appears
   - Confirm folder selection works
   - Check database saves correctly

2. **Enable for more beta users** (if needed)
   - Add more users to feature_flags table
   - Monitor feedback and issues

3. **Plan full rollout**
   - Set timeline for enabling all users
   - Prepare communication for users
   - Document any changes needed

4. **Remove restricted scope**
   - After successful migration
   - Update OAuth consent screen
   - Submit for re-verification if needed
