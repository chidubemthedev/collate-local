"use client";

import { Suspense, use } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useSignInLinkDetails, useSignInWithLink } from "@/lib/hooks/use-auth";
import { WF } from "@/components/ui/wf";
import { cn } from "cn";

/** Where people land after signing in, as after entering a code. */
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

function Checking() {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-8 text-[14px] text-[#737373]">
      <Loader2 className="h-4 w-4 animate-spin" />
      Checking your sign-in link…
    </div>
  );
}

/**
 * Opening the link only shows who it signs in: email scanners open links too, so signing in waits
 * for Continue (a POST they don't send).
 */
function SignInCard({ token }: { token: string }) {
  const details = useSignInLinkDetails(token);
  const signIn = useSignInWithLink(token);

  if (!token) {
    return <Unusable message="This sign-in link is incomplete. Open the whole link from the email, or enter the code instead." />;
  }
  if (details.isPending) return <Checking />;
  if (details.isError) return <Unusable message={details.error.message} />;

  const busy = signIn.isPending || signIn.isSuccess;
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 id="sign-in-link-title" className="m-0 text-[18px] font-bold">
          Sign in to Collate
        </h1>
        <p className="m-0 text-[14px] text-[#737373]">
          {details.data.email ? (
            <>
              You’re signing in as <span className="font-semibold text-[#0A0A0A]">{details.data.email}</span>.
            </>
          ) : (
            "Continue to finish signing in."
          )}
        </p>
      </div>
      {signIn.isError ? (
        <p role="alert" className="m-0 text-[13px] text-[#B42318]">
          {signIn.error.message}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() =>
          signIn.mutate(undefined, {
            // A full page load, so the app starts fresh with the new session.
            onSuccess: () => window.location.replace(HOME),
          })
        }
        disabled={busy}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-[#1E8A55] px-5 text-[15px] font-semibold text-white transition-colors hover:bg-[#18744A] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-11 sm:text-[14px]"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {signIn.isPending ? "Signing in…" : signIn.isSuccess ? "Opening Collate…" : "Continue"}
      </button>
      <p className="m-0 text-[12px] text-[#737373]">
        Not you? <Link href="/login" className="text-[#1E8A55] underline">Sign in with a different email</Link>.
      </p>
    </>
  );
}

function Unusable({ message }: { message: string }) {
  return (
    <>
      <h1 id="sign-in-link-title" className="m-0 text-[18px] font-bold">
        This link can’t be used
      </h1>
      <p role="alert" className="m-0 text-[14px] text-[#737373]">
        {message}
      </p>
      <Link href="/login" className={cn(WF.btnOutline, "min-h-11 text-[14px] no-underline")}>
        Go to sign in
      </Link>
    </>
  );
}

/** The token is in the URL, so it's read inside Suspense (as on /invite/[token]). */
function SignInContent({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = use(searchParams);
  return <SignInCard token={typeof token === "string" ? token : ""} />;
}

/** The page a sign-in email's button opens. Public: no session needed (see isPublicPath). */
export default function SignInLink({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  return (
    <div className="flex min-h-[85vh] flex-col items-center justify-center px-4 py-8 text-[#0A0A0A]">
      <Brand />
      <section className={cn(WF.card, "flex w-full max-w-md flex-col gap-4 p-5 sm:p-6")} aria-labelledby="sign-in-link-title">
        <Suspense fallback={<Checking />}>
          <SignInContent searchParams={searchParams} />
        </Suspense>
      </section>
    </div>
  );
}
