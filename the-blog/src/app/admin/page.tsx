import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { currentMonth, getTimelineMonth, isValidMonth, listTimelineMonths } from "@/lib/timeline";
import TimelineWorkbench from "./TimelineWorkbench";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ month?: string }> };

export default async function AdminHome({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("login");
  const params = await searchParams;
  const months = await listTimelineMonths();
  const requestedMonth = params.month && isValidMonth(params.month) ? params.month : undefined;
  const selectedMonth = requestedMonth || months[0]?.month || currentMonth();
  const selected = await getTimelineMonth(selectedMonth);
  const monthSummaries = months.some((m) => m.month === selected.month)
    ? months.map((m) => ({ month: m.month, filename: m.filename, tracked: m.tracked }))
    : [{ month: selected.month, filename: selected.filename, tracked: selected.tracked }, ...months.map((m) => ({ month: m.month, filename: m.filename, tracked: m.tracked }))];

  return <TimelineWorkbench initialMonth={selected.month} initialBody={selected.body} months={monthSummaries} />;
}
