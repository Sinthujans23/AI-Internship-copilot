import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { analyzeJob, analyzeCv, createDrafts, scoreMatch } from "@/lib/agent/workflow";
const schema = z.object({ description: z.string().min(80).max(20000), cvId: z.string().uuid() });
export async function POST(request: Request) {
 try {
  const input=schema.parse(await request.json());const supabase=await createClient();const {data:{user},error:authError}=await supabase.auth.getUser();if(authError||!user)return NextResponse.json({error:"Sign in to analyze a job."},{status:401});
  const {data:cv,error}=await supabase.from("cvs").select("id,extracted_text,analysis").eq("id",input.cvId).eq("user_id",user.id).single();if(error||!cv)return NextResponse.json({error:"CV not found."},{status:404});
  const [job,cvAnalysis]=await Promise.all([analyzeJob(input.description),cv.analysis?Promise.resolve(z.object({skills:z.array(z.string()),education:z.array(z.string()),projects:z.array(z.string()),experience:z.array(z.string()),qualifications:z.array(z.string())}).parse(cv.analysis)):analyzeCv(cv.extracted_text)]);
  const match=scoreMatch(job,cvAnalysis,cv.extracted_text);const drafts=await createDrafts(job,cvAnalysis);return NextResponse.json({job,match,...drafts});
 }catch(error){if(error instanceof z.ZodError)return NextResponse.json({error:error.issues[0]?.message||"Invalid input."},{status:400});const message=error instanceof Error?error.message:"Analysis failed.";return NextResponse.json({error:message},{status:message.includes("not configured")?503:500});}
}
