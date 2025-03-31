'use client';

import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface EmailVerificationBannerProps {
    userId: string;
}

export default function EmailVerificationBanner({ userId }: EmailVerificationBannerProps) {
    const [isVisible, setIsVisible] = useState(true);
    const [isResending, setIsResending] = useState(false);
    const [resendError, setResendError] = useState('');

    const handleResendVerification = async () => {
        setIsResending(true);
        setResendError('');

        try {
            const response = await fetch('/api/auth/verify-email', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to resend verification email');
            }

            // Show success message temporarily
            setResendError('Verification email sent! Please check your inbox.');
            setTimeout(() => setResendError(''), 5000);
        } catch (error) {
            setResendError(error instanceof Error ? error.message : 'Failed to resend verification email');
        } finally {
            setIsResending(false);
        }
    };

    if (!isVisible) {
        return null;
    }

    return (
        <div className="bg-yellow-50 border-b border-yellow-200">
            <div className="max-w-7xl mx-auto py-3 px-3 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between flex-wrap">
                    <div className="w-0 flex-1 flex items-center">
                        <span className="flex p-2">
                            <svg
                                className="h-6 w-6 text-yellow-600"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                            </svg>
                        </span>
                        <p className="ml-3 font-medium text-yellow-700">
                            <span>Please verify your email address.</span>
                        </p>
                    </div>
                    <div className="flex-shrink-0 sm:ml-3">
                        <button
                            type="button"
                            onClick={handleResendVerification}
                            disabled={isResending}
                            className="-mr-1 flex p-2 rounded-md focus:outline-none sm:ml-3 bg-yellow-50 hover:bg-yellow-100 border-2  border-yellow-600"
                        >
                            <span className="text-yellow-800 text-sm font-medium">
                                {isResending ? 'Sending...' : 'Resend verification email'}
                            </span>
                        </button>
                    </div>
                </div>
                {resendError && (
                    <div className="mt-2 text-sm text-yellow-700">
                        {resendError}
                    </div>
                )}
            </div>
        </div>
    );
} 