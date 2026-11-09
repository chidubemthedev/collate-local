import SignInLink from "@/components/auth/sign-in-link";

/** Where the button in a sign-in email links. Public: no session needed (see isPublicPath). */
export default function SignInLinkPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  return <SignInLink searchParams={searchParams} />;
}
