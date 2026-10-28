// Conservative robots matching for this crawler and wildcard groups.
export function robotsAllows(text:string,path:string){
 const groups:{agents:string[];rules:{allow:boolean;path:string}[]}[]=[];
 let group={agents:[] as string[],rules:[] as {allow:boolean;path:string}[]};
 for(const raw of text.split(/\r?\n/)){
  const line=raw.split("#")[0];const colon=line.indexOf(":");if(colon<0)continue;
  const key=line.slice(0,colon).trim().toLowerCase(),value=line.slice(colon+1).trim();
  if(key==="user-agent"){
   if(group.rules.length){groups.push(group);group={agents:[],rules:[]};}group.agents.push(value.toLowerCase());
  }else if((key==="allow"||key==="disallow")&&group.agents.length&&value)group.rules.push({allow:key==="allow",path:value});
 }
 groups.push(group);
 const specific=groups.filter(g=>g.agents.some(a=>a!=="*"&&"ai-internship-copilot".includes(a)));
 const selected=specific.length?specific:groups.filter(g=>g.agents.includes("*"));
 const decode=(s:string)=>s.replace(/%[0-9a-f]{2}/gi,token=>{const c=String.fromCharCode(parseInt(token.slice(1),16));return /[a-z0-9._~-]/i.test(c)?c:token.toUpperCase();});
 let best=-1,allowed=true;
 for(const rule of selected.flatMap(g=>g.rules)){
  const pattern=decode(rule.path);const end=pattern.endsWith("$");
  const escaped=(end?pattern.slice(0,-1):pattern).split("*").map(p=>p.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join(".*");
  if(new RegExp(`^${escaped}${end?"$":""}`).test(decode(path))){const length=pattern.replace(/[*$]/g,"").length;if(length>best||(length===best&&rule.allow)){best=length;allowed=rule.allow;}}
 }
 return allowed;
}
