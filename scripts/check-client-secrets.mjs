import {readFile,readdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
const names=['OPENAI_API_KEY','OPENROUTER_API_KEY','MATCHING_SERVICE_API_KEY','GITHUB_TOKEN'];
const values=names.map(name=>process.env[name]).filter(value=>value&&value.length>=8);
async function walk(dir){return (await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?walk(`${dir}/${e.name}`):`${dir}/${e.name}`))).flat();}
let checked=0;for(const file of await walk('.next/static')){if(!/\.(js|json|map)$/.test(file))continue;const text=await readFile(file,'utf8');if(values.some(secret=>text.includes(secret)))throw Error('Private key value found in client build. Do not deploy.');checked++;}
console.log(`Checked ${checked} client files against ${values.length} configured private key values; no matches. This is a targeted check, not a complete secret scanner.`);
