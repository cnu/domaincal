'use client';

import { useSession } from 'next-auth/react';
import EmailVerificationBanner from './EmailVerificationBanner';

export default function EmailVerificationBannerWrapper() {
    const { data: session, status } = useSession();

    if (!session?.user || session.user.emailVerified) {
        return null;
    }

    return <EmailVerificationBanner userId={session.user.id} />;
} 