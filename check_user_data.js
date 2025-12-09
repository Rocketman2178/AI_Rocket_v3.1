import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://poquwzvcleazbbdelcsh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvcXV3enZjbGVhemJiZGVsY3NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMjEwNDMsImV4cCI6MjA3MTg5NzA0M30.9k5e6oIxXAjAe2QmqNMERSoNMg2Dw6ngU9amUfPgJoY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserData() {
  console.log('🔍 Checking user data for clay@rockethub.ai...\n');

  // Check public.users table
  const { data: publicUser, error: publicError } = await supabase
    .from('users')
    .select('id, email, name, team_id')
    .eq('email', 'clay@rockethub.ai')
    .single();

  console.log('📊 PUBLIC.USERS TABLE:');
  if (publicError) {
    console.error('Error:', publicError);
  } else {
    console.log('User ID:', publicUser?.id);
    console.log('Email:', publicUser?.email);
    console.log('Name:', publicUser?.name);
    console.log('Team ID:', publicUser?.team_id);
  }

  console.log('\n');

  // Check teams table
  if (publicUser?.team_id) {
    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .select('id, name')
      .eq('id', publicUser.team_id)
      .single();

    console.log('📊 TEAMS TABLE (from public.users.team_id):');
    if (teamError) {
      console.error('Error:', teamError);
    } else {
      console.log('Team ID:', teamData?.id);
      console.log('Team Name:', teamData?.name);
    }
  }

  console.log('\n');
  console.log('⚠️  Note: Cannot check auth.users.raw_user_meta_data with anon key');
  console.log('    This requires service role key or admin access');
  console.log('    The issue is likely that user_metadata contains old team_id');
}

checkUserData();
