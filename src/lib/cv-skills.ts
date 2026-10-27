// Extract only explicitly mentioned skills; the full CV text is also used for matching.
const skills = ["JavaScript", "TypeScript", "Python", "Java", "C++", "C#", "HTML", "CSS", "React", "Next.js", "Node.js", "FastAPI", "Django", "Flask", "SQL", "PostgreSQL", "MySQL", "MongoDB", "Supabase", "Git", "Docker", "Kubernetes", "AWS", "Azure", "Linux", "Figma", "Excel", "Power BI", "TensorFlow", "PyTorch", "Pandas", "NumPy", "REST", "GraphQL", "Agile", "Communication", "Teamwork"];

export function extractCvSkills(text: string) {
  return skills.filter(skill => {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i").test(text);
  });
}
