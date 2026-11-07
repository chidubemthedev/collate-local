"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useCompleteInvite, useInviteDetails } from "@/lib/hooks/use-invite";
import { WF } from "@/components/ui/wf";
import { cn } from "cn";

/** Where a candidate lands after completing registration. */
const HOME = "/coverage";

function Brand() {
  return (
    <div className="mb-6 flex flex-col items-center text-center">
      <span
        aria-hidden="true"
        className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#1E8A55] text-lg font-bold text-white"
      >
        PU
      </span>
      <p className="m-0 text-[20px] font-bold text-[#0A0A0A] sm:text-[24px]">Collate</p>
      <p className="m-0 mt-1 max-w-sm text-[13px] text-[#737373]">Polling unit coverage and campaign messaging</p>
    </div>
  );
}

/**
 * The page an invite email links to. Shows who the invite is for; "Complete registration" saves
 * the email on the candidate and signs them in. No sign-in needed to open it.
 */
export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const token = typeof params.token === "string" ? params.token : "";
  const details = useInviteDetails(token);
  const complete = useCompleteInvite(token);

  const finish = () =>
    complete.mutate(undefined, {
      // A full page load, so the app starts fresh with the new session.
      onSuccess: () => window.location.replace(HOME),
    });

  return (
    <div className="flex min-h-[85vh] flex-col items-center justify-center px-4 py-8 text-[#0A0A0A]">
      <Brand />
      <section className={cn(WF.card, "flex w-full max-w-md flex-col gap-4 p-5 sm:p-6")} aria-labelledby="invite-title">
        {details.isPending ? (
          <div role="status" className="flex items-center justify-center gap-2 py-8 text-[14px] text-[#737373]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking your invite…
          </div>
        ) : details.isError ? (
          <>
            <h1 id="invite-title" className="m-0 text-[18px] font-bold">
              This invite can’t be used
            </h1>
            <p role="alert" className="m-0 text-[14px] text-[#737373]">
              {details.error.message}
            </p>
            <Link href="/login" className={cn(WF.btnOutline, "min-h-11 text-[14px] no-underline")}>
              Go to sign in
            </Link>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <h1 id="invite-title" className="m-0 text-[18px] font-bold">
                Complete your registration
              </h1>
              <p className="m-0 text-[14px] text-[#737373]">You’ve been invited to Collate. Check these details are yours.</p>
            </div>
            <dl className="m-0 grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-[10px] bg-[#FAFAFA] p-3.5 text-[14px]">
              <dt className="text-[#737373]">Name</dt>
              <dd className="m-0 font-semibold">{details.data.fullName}</dd>
              <dt className="text-[#737373]">Running for</dt>
              <dd className="m-0">
                {details.data.title === "President" || details.data.title === "Vice President"
                  ? details.data.title
                  : `${details.data.title}, ${details.data.seat}`}
              </dd>
              <dt className="text-[#737373]">Email</dt>
              <dd className="m-0 break-all">{details.data.email}</dd>
            </dl>
            <p className="m-0 text-[12px] text-[#737373]">
              After this you’ll sign in with a code sent to this email. This link works once.
            </p>
            {complete.isError ? (
              <p role="alert" className="m-0 text-[13px] text-[#B42318]">
                {complete.error.message}
              </p>
            ) : null}
            <button
              type="button"
              onClick={finish}
              disabled={complete.isPending || complete.isSuccess}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-[#1E8A55] px-5 text-[15px] font-semibold text-white transition-colors hover:bg-[#18744A] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-11 sm:text-[14px]"
            >
              {complete.isPending || complete.isSuccess ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {complete.isPending ? "Completing…" : complete.isSuccess ? "Signing you in…" : "Complete registration"}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
