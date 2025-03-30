'use client';

import { useSession } from 'next-auth/react';
import EmailVerificationBanner from './EmailVerificationBanner';

export default function EmailVerificationBannerWrapper() {
    const { data: session } = useSession();

    console.log('Current session:', JSON.stringify(session, null, 2));

    if (!session?.user || session.user.emailVerified) {
        return null;
    }

    return <EmailVerificationBanner userId={session.user.id} />;
} 