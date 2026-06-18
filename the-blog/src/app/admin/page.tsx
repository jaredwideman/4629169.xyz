import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getTimelineSource } from "@/lib/timeline";
import TimelineWorkbench from "./TimelineWorkbench";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const session = await getSession();
  if (!session) redirect("login");
  const source = await getTimelineSource();

  return <TimelineWorkbench initialBody={source.body} />;
}
