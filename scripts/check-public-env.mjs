import {existsSync} from 'node:fs';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'';
let role='';try{role=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role;}catch{}
if(key.startsWith('sb_secret_')||role==='service_role')throw Error('A private Supabase key is configured in a public variable. Replace it and rotate the exposed key before building.');
for(const name of Object.keys(process.env))if(/^NEXT_PUBLIC_.*(OPENAI|OPENROUTER|SERVICE_ROLE|GITHUB_TOKEN|MATCHING_SERVICE_API_KEY)/.test(name)&&process.env[name])throw Error('A private-service variable uses NEXT_PUBLIC_. Remove it before building.');
console.log('Public environment variable safety check passed.');
