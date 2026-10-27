import { normalizeJobs } from "./job-search";

// Shared public feeds only: CV text and search preferences never leave this app.
const sources = [
  { name: "Arbeitnow Europe", host: "www.arbeitnow.com" },
  { name: "Arbeitnow UK", host: "www.arbeitnow.co.uk" },
];
export async function publicJobs() {
  const results = await Promise.allSettled(sources.map(async source => {
    const response = await fetch(`https://${source.host}/api/job-board-api`, { next: { revalidate: 21600 }, signal: AbortSignal.timeout(12000), redirect: "error" });
    if (!response.ok) throw new Error("Source unavailable");
    const text = await response.text();
    if (text.length > 4_000_000) throw new Error("Feed too large");
    return normalizeJobs(JSON.parse(text), source.name, source.host);
  }));
  return {
    jobs: results.flatMap(result => result.status === "fulfilled" ? result.value : []),
    warnings: results.flatMap((result, i) => result.status === "rejected" ? [`${sources[i].name} is unavailable. Other results and external search links are still available.`] : []),
  };
}
