import { z } from "zod";
import { load } from "cheerio";
import { extractCvSkills } from "./cv-skills";

export const searchSchema = z.object({ role: z.string().trim().min(2).max(120), location: z.string().trim().max(120), remote: z.boolean(), internships: z.boolean() });
export type JobSearch = z.infer<typeof searchSchema>;
export type PublicJob = { id: string; title: string; company: string; location: string; remote: boolean; url: string; description: string; source: string; published: string | null; skills: string[] };
export type RankedJob = PublicJob & { matched_skills: string[]; other_skills: string[]; overlap: number | null };
const rowSchema = z.object({ slug: z.string(), title: z.string(), company_name: z.string(), description: z.string(), location: z.string(), remote: z.boolean(), url: z.string(), created_at: z.number().optional() });

export function normalizeJobs(input: unknown, source: string, host: string): PublicJob[] {
  const envelope = z.object({ data: z.array(z.unknown()) }).parse(input);
  return envelope.data.slice(0, 100).flatMap(raw => {
    const parsed = rowSchema.safeParse(raw);
    if (!parsed.success) return [];
    const row = parsed.data;
    try {
      const url = new URL(row.url);
      if (url.protocol !== "https:" || url.hostname !== host || url.username || url.password || url.port) return [];
    } catch { return []; }
    // Never render publisher HTML. Preserve paragraph boundaries for analysis.
    const $ = load(row.description.slice(0, 100000));
    $("script,style,iframe").remove(); $("p,li,br,h1,h2,h3").prepend("\n");
    const description = $.text().replace(/[ \t]+/g, " ").trim().slice(0, 18000);
    const date = new Date((row.created_at || 0) * 1000);
    return [{ id: `${source}:${row.slug}`, title: row.title.slice(0, 200), company: row.company_name.slice(0, 200), location: row.location.slice(0, 200), remote: row.remote, url: row.url, description, source, published: row.created_at && Number.isFinite(date.getTime()) ? date.toISOString() : null, skills: extractCvSkills(description) }];
  });
}

export function rankJobs(jobs: PublicJob[], skills: string[], query: JobSearch): RankedJob[] {
  const known = new Set(skills.map(skill => skill.toLowerCase()));
  const words = query.role.toLowerCase().split(/\s+/).filter(Boolean);
  const seen = new Set<string>();
  return jobs.filter(job => {
    if (seen.has(job.url)) return false;
    seen.add(job.url);
    if (query.remote && !job.remote) return false;
    if (query.location && !job.location.toLowerCase().includes(query.location.toLowerCase())) return false;
    if (query.internships && !/intern|trainee|working student|werkstudent|praktik/i.test(job.title)) return false;
    return words.some(word => job.title.toLowerCase().includes(word));
  }).map(job => {
    const matched = job.skills.filter(skill => known.has(skill.toLowerCase()));
    return { ...job, matched_skills: matched, other_skills: job.skills.filter(skill => !known.has(skill.toLowerCase())), overlap: job.skills.length ? Math.round(matched.length / job.skills.length * 100) : null };
  }).sort((a, b) => (b.overlap ?? -1) - (a.overlap ?? -1) || b.matched_skills.length - a.matched_skills.length).slice(0, 30);
}

