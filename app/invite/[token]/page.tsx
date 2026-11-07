import InviteRegistration from "@/components/invite/invite-registration";

/** Where an invite email links. Public: no sign-in needed (see isPublicPath). */
export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  return <InviteRegistration params={params} />;
}
