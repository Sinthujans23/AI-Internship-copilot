import type { CvReview } from "@/lib/cv-review-schema";

export function CvReviewCard({ review }: { review: CvReview }) {
  return <div className="space-y-4 rounded-xl border border-violet-200 bg-violet-50 p-5">
    <div className="flex flex-wrap items-center gap-4"><p className="text-4xl font-bold text-violet-800">{review.score}<span className="text-lg"> / 10</span></p><div><h3 className="text-xl font-semibold">CV quality review</h3><p className="text-sm text-slate-600">AI estimate based on extracted text, not a hiring prediction or visual layout assessment.</p></div></div>
    <p>{review.summary}</p>
    <div className="grid gap-3 sm:grid-cols-2">{Object.entries(review.criteria).map(([name, item]) => <div key={name} className="rounded bg-white p-3"><h4 className="font-semibold capitalize">{name} · {item.score}/2</h4><p className="mt-1 text-sm text-slate-700">{item.feedback}</p></div>)}</div>
    {review.strengths.length > 0 && <div><h4 className="font-semibold">What works well</h4><ul className="mt-2 list-disc space-y-1 pl-5">{review.strengths.map((strength, i) => <li key={i}>{strength}</li>)}</ul></div>}
    <div><h4 className="font-semibold">Recommended improvements</h4><ol className="mt-2 space-y-3">{review.improvements.map((item, i) => <li key={i} className="rounded bg-white p-3"><p className="font-medium">{i + 1}. {item.area} <span className="text-sm text-violet-700">({item.priority} priority)</span></p><p className="mt-1 text-sm">{item.recommendation}</p></li>)}</ol></div>
    <p className="text-xs text-slate-600">Saved review · {new Date(review.reviewed_at).toISOString().slice(0, 10)}. Upload an updated CV for a new assessment.</p>
  </div>;
}
