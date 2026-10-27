import { redirect } from "next/navigation";

// Older tracker bookmarks now open the CV-first workspace.
export default function LegacyTrackerPage() {
  redirect("/profile");
}
