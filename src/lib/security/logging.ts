// Log only an allowlisted event and status. Never log errors, URLs, bodies or user IDs.
export function safeEvent(event:"api_failure"|"operation_complete"|"operation_failed",status:number,durationMs?:number){
 console.info(JSON.stringify({event,status,...(durationMs===undefined?{}:{duration_ms:Math.max(0,Math.round(durationMs))})}));
}
