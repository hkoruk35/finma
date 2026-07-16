const fs = require('fs');

const path = 'C:/Users/afksm/finma/frontend/app/api/members/register/route.ts';
let content = fs.readFileSync(path, 'utf8');

// Add region and selectedLanguage to body
content = content.replace(
  '    consentAccepted?: boolean;\n  };',
  '    consentAccepted?: boolean;\n    region?: string;\n    selectedLanguage?: string;\n  };'
);

content = content.replace(
  'const { email, password, username, redirectTo, consentAccepted } = body;',
  'const { email, password, username, redirectTo, consentAccepted, region, selectedLanguage } = body;'
);

// Update Supabase sign up
const signupSearch = `  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
      emailRedirectTo: redirectTo
    },
  });`;

const signupReplace = `  const origin = req.nextUrl.origin;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, region, language: selectedLanguage || locale },
      emailRedirectTo: \`\${origin}/api/auth/confirm\`
    },
  });`;
content = content.replace(signupSearch, signupReplace);

// Add region to members table
const upsertSearch = `        username,
        email,
        plan: "pending",`;
const upsertReplace = `        username,
        email,
        region,
        plan: "pending",`;
content = content.replace(upsertSearch, upsertReplace);

fs.writeFileSync(path, content, 'utf8');
console.log("Updated register route");
