"use client";

import { useSession } from "next-auth/react";
import type { Session } from "next-auth";
import EmailVerificationBanner from "./EmailVerificationBanner";

export default function EmailVerificationBannerWrapper() {
  const { data: session, status } = useSession() as {
    data: Session | null;
    status: string;
  };

  // Only show banner for authenticated users with unverified emails
  if (
    status !== "authenticated" ||
    !session?.user ||
    session.user.emailVerified
  ) {
    return null;
  }

  return <EmailVerificationBanner />;
}
