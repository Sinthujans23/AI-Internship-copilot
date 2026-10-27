"""Small, testable cosine-similarity scoring helpers."""
import math


def cosine(left: list[float], right: list[float]) -> float:
    if not left or len(left) != len(right):
        raise ValueError("Embedding dimensions do not match")
    if not all(math.isfinite(value) for value in left + right):
        raise ValueError("Invalid embedding values")
    denominator = math.sqrt(sum(v * v for v in left) * sum(v * v for v in right))
    return max(0.0, min(1.0, sum(a * b for a, b in zip(left, right)) / denominator)) if denominator else 0.0


def score_embeddings(cv_vectors, job_vectors, cv_skills, job_skills, threshold=0.65):
    exact = {skill.strip().casefold() for skill in cv_skills}
    matched, missing, scores = [], [], []
    for skill, vector in zip(job_skills, job_vectors):
        similarity = 1.0 if skill.strip().casefold() in exact else max((cosine(vector, evidence) for evidence in cv_vectors), default=0.0)
        scores.append(similarity)
        (matched if similarity >= threshold else missing).append(skill)
    return {"score": round(100 * sum(scores) / len(scores)) if scores else 0,
            "matched_skills": matched, "missing_skills": missing}
