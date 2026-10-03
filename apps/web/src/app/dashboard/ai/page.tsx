import { redirect } from "next/navigation";

// "AI Analysis" became Trade Review (/dashboard/review); keep old links and bookmarks working.
export default function AiAnalysisPage() {
  redirect("/dashboard/review");
}
