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

if (!url || !serviceRoleKey) {
  console.error("Missing SUPABASE URL or SERVICE ROLE KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function main() {
  const email = 'hod.aiml@aits-tpt.edu.in';
  const password = 'hodpassword123';
  const fullName = 'Dr. M. Sreenivasulu';
  const designation = 'HOD';
  const departmentId = '74889c25-bb35-430c-ab22-0d12759e663a'; // AI&ML department ID

  console.log(`Creating dummy HOD account: ${email}...`);

  // 1. Create Auth user
  let userId;
  const { data, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: 'faculty',
      full_name: fullName,
      designation: designation,
      department_id: departmentId
    }
  });

  if (createError) {
    if (createError.message.includes('already registered') || createError.message.includes('already exists')) {
      console.log("HOD account already exists in Supabase Auth.");
    } else {
      console.error("Failed to create auth user:", createError);
      process.exit(1);
    }
  } else {
    console.log("Auth user created successfully with ID:", data.user.id);
    userId = data.user.id;
  }

  // 2. Query target profile (the trigger should have created the profile row)
  if (!userId) {
    const { data: profiles, error: profileFetchError } = await supabase
      .from('profiles')
      .select('id')
      .eq('designation', designation)
      .limit(1);

    if (profileFetchError || !profiles || profiles.length === 0) {
      console.error("Failed to find profile:", profileFetchError || "No profiles match designation");
      process.exit(1);
    }
    userId = profiles[0].id;
  }

  // 3. Update profile to be approved
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ is_approved: true })
    .eq('id', userId);

  if (updateError) {
    console.error("Failed to approve HOD profile:", updateError);
    process.exit(1);
  }

  console.log("\n=============================================");
  console.log("Dummy HOD Account Created & Approved Successfully!");
  console.log("Email:    hod.aiml@aits-tpt.edu.in");
  console.log("Password: hodpassword123");
  console.log("Designation: HOD");
  console.log("=============================================\n");
}

main();
