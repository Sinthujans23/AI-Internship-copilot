import {NextResponse} from "next/server";
export const dynamic="force-dynamic";
// Liveness only: deliberately avoids provider requests and exposes no configuration.
export function GET(){return NextResponse.json({status:"ok"},{headers:{"Cache-Control":"no-store"}});}
