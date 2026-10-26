import { redirect } from "next/navigation";

// Keep old bookmarks working; the Step 1 tracker lives on the dashboard.
export default function Applications() {
  redirect("/dashboard");
}
