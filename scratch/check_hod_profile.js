const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Read .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envText = fs.readFileSync(envPath, 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const url = env['NEXT_PUBLIC_SUPABASE_URL'];
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY'];

const supabase = createClient(url, serviceRoleKey);

async function main() {
  console.log("Checking auth users...");
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.error("Auth error:", authError);
    return;
  }

  const hodUser = users.find(u => u.email === 'hod.aiml@aits-tpt.edu.in');
  if (!hodUser) {
    console.log("HOD user NOT found in Supabase Auth.");
    return;
  }

  console.log("Auth User Found:", {
    id: hodUser.id,
    email: hodUser.email,
    role: hodUser.role,
    user_metadata: hodUser.user_metadata
  });

  console.log("\nChecking database profiles...");
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', hodUser.id)
    .single();

  if (profileError) {
    console.error("Profile Query Error:", profileError);
    return;
  }

  console.log("Database Profile Found:", profile);
}

main();
