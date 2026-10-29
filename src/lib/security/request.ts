import {AppError} from "../api";
// Bound bytes while reading, rather than trusting Content-Length supplied by a client.
export async function boundedBody(request:Request,limit:number){
 const reader=request.body?.getReader();if(!reader)return new Uint8Array();const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new AppError("Request body is too large.",413);}chunks.push(value);}}finally{reader.releaseLock();}
 const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result;
}
export async function readJson(request:Request){return JSON.parse(new TextDecoder().decode(await boundedBody(request,100000)));}
export async function readForm(request:Request){const bytes=await boundedBody(request,4*1024*1024+65536);try{return await new Response(bytes,{headers:{"Content-Type":request.headers.get("Content-Type")||""}}).formData();}catch{throw new AppError("Send a valid multipart PDF upload.",400);}}
export function trustedMutation(request:Request){const origin=request.headers.get("origin");return !origin||origin===new URL(request.url).origin;}
