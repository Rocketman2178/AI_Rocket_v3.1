# N8N Supabase Service Role Configuration Guide

## Problem Summary

N8N workflows were unable to query the `documents` table for some teams (e.g., Coroneos Holdings) but worked for others (e.g., RocketHub). This caused duplicate file processing because the workflow couldn't detect existing files.

## Root Cause

1. **RLS Was Disabled**: The `documents` table had Row Level Security disabled
2. **No RLS Policies**: Without RLS policies, the anon key returned 0 results
3. **Team-Specific Failures**: Different teams experienced different behavior based on which API key was being used

## Solution Implemented

### 1. Enabled RLS on Documents Table
- Migration: `enable_rls_on_documents_table.sql`
- Status: ✅ Completed
- Result: `documents` table now has `rowsecurity: true`

### 2. Created Comprehensive RLS Policies
Four policies were created for the `documents` table:

| Policy Name | Command | Purpose |
|-------------|---------|---------|
| Team members can view team documents | SELECT | Users can view documents from their team |
| Team members can insert team documents | INSERT | Users can create documents for their team |
| Team members can update team documents | UPDATE | Users can modify their team's documents |
| Team members can delete team documents | DELETE | Users can remove their team's documents |

All policies include super admin bypass using `is_super_admin()` function.

### 3. Service Role Key Configuration

**CRITICAL**: N8N workflows MUST use the **Service Role Key** (not the Anon Key) to access Supabase.

#### Why Service Role Key?
- **Bypasses RLS**: Service role key has full database access regardless of RLS policies
- **Works for All Teams**: No team-specific permission issues
- **Automation-Friendly**: Designed for backend/automation use cases

#### Where to Find Your Service Role Key
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to: **Settings** → **API**
4. Copy the **service_role key** (sometimes labeled as "secret" key)
5. ⚠️ **NEVER** use this key in client-side code - it's for server/automation only

## N8N Configuration Steps

### Step 1: Update Supabase Credentials in N8N

1. Open your N8N instance
2. Go to: **Credentials** → Find your "Supabase RocketHub" credential
3. Update the following fields:
   - **Host**: `https://poquwzvcleazbbdelcsh.supabase.co`
   - **Service Role Key**: `[YOUR_SERVICE_ROLE_KEY_HERE]`
4. Save the credential
5. Test the connection

### Step 2: Verify Workflow Configuration

For workflows that interact with the `documents` table:

1. **Get Team's Existing Documents** node:
   - Ensure it uses the Supabase credential with service role key
   - Function call: `get_existing_file_ids(team_id)`
   - This function uses `SECURITY DEFINER` but service role key ensures universal access

2. **Insert/Update Document Records**:
   - All document operations should use the same service role credential
   - This ensures consistent access across all teams

### Step 3: Test with Multiple Teams

Test the workflow with at least:
- ✅ RocketHub (157 documents)
- ✅ Coroneos Holdings (8 documents)
- ✅ Mountain Mist Cabins (59 documents)
- ✅ Hydra Maxx (39 documents)

Expected behavior: All teams should return their respective document counts.

## Security Considerations

### Defense-in-Depth Architecture
Even though service role bypasses RLS, having policies in place provides:
1. **Protection if credentials leak**: If someone gets anon key, they can't access all data
2. **Audit trail**: Clear documentation of intended access patterns
3. **Future-proofing**: If we add user-facing document access, policies are already in place
4. **Best practice compliance**: Follows Supabase security guidelines

### Service Role Key Security
- ✅ **DO**: Use service role in backend services (N8N, Edge Functions, server-side apps)
- ✅ **DO**: Store service role key in secure environment variables
- ✅ **DO**: Rotate the key periodically
- ❌ **DON'T**: Use service role key in client-side code (React, mobile apps)
- ❌ **DON'T**: Commit service role key to version control
- ❌ **DON'T**: Share service role key publicly

## Troubleshooting

### Workflow Still Returns 0 Documents

**Check 1**: Verify Service Role Key
```bash
# In N8N, check the Supabase credential configuration
# Ensure "Service Role Key" field is populated with service_role key (not anon key)
```

**Check 2**: Verify Team ID is Correct
```sql
-- Run this query to see all teams and their document counts
SELECT
  t.id as team_id,
  t.name as team_name,
  COUNT(d.id) as document_count
FROM teams t
LEFT JOIN documents d ON d.team_id = t.id
GROUP BY t.id, t.name
ORDER BY document_count DESC;
```

**Check 3**: Test RLS Policies
```sql
-- Test if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'documents';

-- Should return: rowsecurity: true
```

**Check 4**: Test Service Role Access
```bash
# Using curl to test service role access
curl -X POST 'https://poquwzvcleazbbdelcsh.supabase.co/rest/v1/rpc/get_existing_file_ids' \
  -H "apikey: [SERVICE_ROLE_KEY]" \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"p_team_id": "98242133-ebda-440d-9000-1a9ac8c722e0"}'
```

### Documents Not Showing Up for Specific Team

**Possible Causes**:
1. `team_id` is NULL in documents table
2. `team_id` doesn't match any team in the `teams` table
3. Documents exist but have wrong `source_type` (should be 'google_drive')

**Diagnostic Query**:
```sql
-- Check documents for specific team
SELECT
  id,
  source_id,
  title,
  team_id,
  source_type,
  created_at
FROM documents
WHERE team_id = '98242133-ebda-440d-9000-1a9ac8c722e0'
ORDER BY created_at DESC;
```

## Migration Details

### Migration File
- **Filename**: `enable_rls_on_documents_table.sql`
- **Applied**: 2025-11-27
- **Tables Modified**: `documents`
- **Policies Created**: 4 (SELECT, INSERT, UPDATE, DELETE)

### Data Integrity Check Results
- **Total Documents**: 290
- **Documents with NULL team_id**: 0 ✅
- **Teams with Documents**: 6
  - RocketHub: 157 docs
  - Mountain Mist Cabins: 59 docs
  - Hydra Maxx: 39 docs
  - RocketHub Labs: 26 docs
  - Coroneos Holdings: 8 docs
  - Emery Lane Group: 1 doc

## Related Documentation
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [N8N Supabase Integration](https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.supabase/)
- [Team Structure N8N Guide](./TEAM_STRUCTURE_N8N_GUIDE.md)

## Next Steps

1. ✅ Enable RLS on `documents` table - COMPLETED
2. ✅ Create RLS policies - COMPLETED
3. ✅ Document service role configuration - COMPLETED
4. ⏳ Update N8N credentials to use service role key - **ACTION REQUIRED**
5. ⏳ Test workflow with all teams - **ACTION REQUIRED**
6. ⏳ Monitor for duplicate processing issues - **ONGOING**

## Success Criteria

The fix is successful when:
- ✅ N8N workflow returns correct document counts for ALL teams
- ✅ No duplicate documents are processed
- ✅ `get_existing_file_ids()` function works reliably
- ✅ New teams can be added without permission issues
- ✅ RLS policies protect data when using anon key (client-side)
- ✅ Service role key provides full access for automation (N8N)
