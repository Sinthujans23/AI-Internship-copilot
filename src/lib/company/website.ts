import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { load } from "cheerio";
import ipaddr from "ipaddr.js";
import { AppError } from "@/lib/api";
import type { ResearchSource } from "./schema";

export function isPublicAddress(address: string) {
  try { return ipaddr.process(address).range() === "unicast"; } catch { return false; }
}
export function companyUrl(input: string) {
  let url: URL;
  try { url = new URL(input.includes("://") ? input : `https://${input}`); }
  catch { throw new AppError("Enter a valid public company or job-post URL.", 400); }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) throw new AppError("Use a public HTTPS link without a username/password or custom port.", 400);
  if (url.hostname === "localhost" || url.hostname.endsWith(".local") || (ipaddr.isValid(url.hostname.replace(/^\[|\]$/g, "")) && !isPublicAddress(url.hostname.replace(/^\[|\]$/g, "")))) throw new AppError("Private or local network links are not allowed.", 400);
  url.hash = "";
  return url;
}

type AddressResolver = (hostname: string) => Promise<{ address: string; family: number }[]>;
export async function resolvePublicHost(hostname: string, resolver: AddressResolver = name => lookup(name, { all: true }), timeoutMs = 8000) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let addresses: { address: string; family: number }[];
  try {
    addresses = await Promise.race([resolver(hostname), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("DNS timeout")), Math.max(1, timeoutMs)); })]);
  } catch { throw new AppError("Could not resolve the company website. Check the public URL.", 422); }
  finally { clearTimeout(timer); }
  if (!addresses.length || addresses.some(address => !isPublicAddress(address.address))) throw new AppError("The website resolves to a private or reserved address.", 400);
  return addresses.find(address => address.family === 4) || addresses[0];
}

async function readHtml(url: URL, deadline: number): Promise<{ html: string; redirect?: string }> {
  if (Date.now() >= deadline) throw new AppError("Website research timed out. Use a direct job-post link.", 422);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const pinned = await resolvePublicHost(hostname, undefined, Math.min(8000, deadline - Date.now()));
  if (Date.now() >= deadline) throw new AppError("Website research timed out. Use a direct job-post link.", 422);
  return new Promise((resolve, reject) => {
    // Pin the validated DNS result; redirects are revalidated separately.
    const req = request(url, {
      family: pinned.family,
      lookup: (_host, _options, callback) => callback(null, pinned.address, pinned.family),
      headers: { "User-Agent": "AI-Internship-Copilot/1.0", Accept: "text/html", "Accept-Encoding": "identity" },
    }, response => {
      const status = response.statusCode || 500;
      if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) { response.resume(); resolve({ html: "", redirect: new URL(response.headers.location, url).href }); return; }
      if (status !== 200 || !/text\/html|application\/xhtml\+xml/i.test(response.headers["content-type"] || "") || (response.headers["content-encoding"] && response.headers["content-encoding"] !== "identity")) { response.resume(); reject(new AppError("The website could not be read as a public HTML page. Try a direct careers/job link.", 422)); return; }
      const chunks: Buffer[] = []; let length = 0;
      response.on("data", (chunk: Buffer) => {
        length += chunk.length;
        if (length > 1024 * 1024) { req.destroy(); reject(new AppError("Website response is too large. Use a specific job-post page.", 422)); }
        else chunks.push(chunk);
      });
      response.on("end", () => resolve({ html: Buffer.concat(chunks).toString("utf8") }));
      response.on("error", () => reject(new AppError("The website connection was interrupted.", 502)));
    });
    const timer = setTimeout(() => req.destroy(), Math.max(1, Math.min(12000, deadline - Date.now())));
    req.on("close", () => clearTimeout(timer));
    req.on("error", () => reject(new AppError("Could not read the website. It may block automated access or require JavaScript; use a direct job link.", 422)));
    req.end();
  });
}

export function extractWebsite(html: string, url: string) {
  const $ = load(html);
  const title = $("title").text().trim().slice(0, 200) || new URL(url).hostname;
  const related = $("a[href]").map((_, element) => {
    const anchor = $(element); const href = anchor.attr("href") || "";
    if (!/career|jobs|engineering|technolog|certification/i.test(`${anchor.text()} ${href}`)) return "";
    try { const link = companyUrl(new URL(href, url).href); return link.origin === new URL(url).origin ? link.href : ""; } catch { return ""; }
  }).get().filter(Boolean);
  $("script,style,noscript,iframe,svg,nav,footer,header,form").remove();
  $("p,li,div,h1,h2,h3,h4,section,br,tr").append("\n");
  const text = $("body").text().replace(/[\t ]+/g, " ").replace(/\n\s*\n/g, "\n").trim().slice(0, 16000);
  return { title, text, related: [...new Set(related)].filter(value => value !== url).slice(0, 2) };
}

async function fetchSource(input: string, deadline: number) {
  let url = companyUrl(input);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const result = await readHtml(url, deadline);
    if (result.redirect) { url = companyUrl(result.redirect); continue; }
    const extracted = extractWebsite(result.html, url.href);
    if (extracted.text.length < 80) throw new AppError("Not enough readable website text. Use a direct, public job-post URL.", 422);
    return { source: { url: url.href, title: extracted.title, text: extracted.text, retrieved_at: new Date().toISOString() } satisfies ResearchSource, related: extracted.related };
  }
  throw new AppError("Too many website redirects. Use the final public page URL.", 422);
}
export async function fetchCompanySources(input: string) {
  const deadline = Date.now() + 35000;
  const first = await fetchSource(input, deadline);
  const sources = [first.source];
  for (const link of first.related) {
    if (Date.now() >= deadline - 1000) break;
    try { const next = await fetchSource(link, deadline); if (!sources.some(source => source.url === next.source.url)) sources.push(next.source); }
    catch { /* A blocked extra page must not invalidate the readable primary page. */ }
  }
  return sources;
}
