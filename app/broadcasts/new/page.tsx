import { NewBroadcastForm } from "@/components/broadcasts/new/new-broadcast-form";

/** `?personId=<uuid>` opens the form for one agent ("Message this agent"). */
export default function NewBroadcastPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return <NewBroadcastForm searchParams={searchParams} />;
}
