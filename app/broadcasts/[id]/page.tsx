import LiveBroadcastReport from "@/components/broadcasts/live-broadcast-report";

export default function BroadcastReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <LiveBroadcastReport params={params} />;
}
