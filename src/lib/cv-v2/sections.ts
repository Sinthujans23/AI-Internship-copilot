import { sectionNames, type Section } from "./schema";

const aliases: Record<Section["name"], string[]> = {
  contact: ["contact", "contact information", "contact details", "personal details"],
  summary: ["summary", "professional summary", "profile", "career objective", "objective", "about me"],
  education: ["education", "academic qualifications", "academic background", "educational qualifications"],
  skills: ["skills", "technical skills", "technical expertise", "core competencies", "technologies"],
  projects: ["projects", "personal projects", "academic projects", "selected projects", "project experience"],
  experience: ["experience", "work experience", "professional experience", "employment history", "internships", "volunteer experience"],
  certifications: ["certifications", "certificates", "professional certifications", "licenses and certifications"],
  achievements: ["achievements", "awards", "honors", "awards and achievements", "honours and awards"],
};
export const emailPattern = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i;
export const phonePattern = /(?:\+\d{1,3}[ .-]?)?(?:\(?\d{2,4}\)?[ .-]){2,4}\d{3,4}|\+\d{9,15}/;

// Exact short heading lines, or "Heading: content", not arbitrary keyword mentions.
function heading(line: string): { name: Section["name"]; content: string } | null {
  const cleaned = line.trim().replace(/^[#*\s]+|[*\s]+$/g, "").replace(/^\d+[.)]\s*/, "");
  const colon = cleaned.indexOf(":");
  const title = (colon < 0 ? cleaned : cleaned.slice(0, colon)).toLowerCase().trim().replace(/\s+/g, " ");
  for (const name of sectionNames) if (aliases[name].includes(title)) return { name, content: colon < 0 ? "" : cleaned.slice(colon + 1).trim() };
  return null;
}
export function detectSections(text: string): Section[] {
  const lines = text.split(/\r?\n/);
  const found = lines.flatMap((line, index) => { const value = heading(line); return value ? [{ ...value, index, heading: line.trim() }] : []; });
  return sectionNames.map(name => {
    const blocks = found.filter(item => item.name === name).map(item => {
      const next = found.find(value => value.index > item.index)?.index ?? lines.length;
      return { ...item, body: [item.content, ...lines.slice(item.index + 1, next)].join("\n").trim() };
    });
    const body = blocks.map(block => block.body).join("\n");
    const contactLine = lines.findIndex(line => emailPattern.test(line) || phonePattern.test(line));
    if (name === "contact" && contactLine >= 0) return { name, status: "detected", heading: blocks[0]?.heading || null, evidence: "Contact channel detected (value hidden).", reason: "An email or phone-like contact channel was found; ownership/deliverability is not verified.", line: contactLine + 1 };
    if (!blocks.length) return { name, status: "missing", heading: null, evidence: "", reason: "No recognized heading found. Content may use a different heading or PDF reading order.", line: null };
    const meaningful = body.replace(/\b(?:n\/?a|none|tbd|coming soon)\b/gi, "").replace(/[^\p{L}\p{N}]/gu, "");
    const complete = name === "contact" ? false : meaningful.length >= (name === "skills" ? 3 : 20);
    return { name, status: complete ? "detected" : "incomplete", heading: blocks[0].heading, evidence: name === "contact" ? "Contact heading found; usable channel not detected." : body.slice(0, 700), reason: complete ? "Recognized heading with text content; correctness is not verified." : "Heading found but little usable content was detected.", line: blocks[0].index + 1 };
  });
}

export function redactContact(text: string) {
  // Minimize contact sharing. This is not a guarantee of full anonymization.
  let inContact = false;
  return text.split(/\r?\n/).map(line => {
    const found = heading(line);
    if (found) inContact = found.name === "contact";
    if (inContact || emailPattern.test(line) || phonePattern.test(line)) return "[contact details omitted]";
    return line.replace(/https?:\/\/\S+|www\.\S+/gi, "[link omitted]");
  }).join("\n");
}
