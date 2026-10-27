import type { JobSearch } from "./job-search";

export function platformSearches(query: JobSearch) {
  const keywords = `${query.role}${query.internships ? " internship" : ""}${query.remote ? " remote" : ""}`;
  return [
    { name: "LinkedIn", url: `https://www.linkedin.com/jobs/search/?${new URLSearchParams({ keywords, location: query.location })}` },
    { name: "Indeed", url: `https://www.indeed.com/jobs?${new URLSearchParams({ q: keywords, l: query.location })}` },
    { name: "Google Jobs search", url: `https://www.google.com/search?${new URLSearchParams({ q: `${keywords} jobs ${query.location}` })}` },
  ];
}
