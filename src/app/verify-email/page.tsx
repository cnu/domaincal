'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

export default function VerifyEmailPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
    const [error, setError] = useState('');
    const { update: updateSession } = useSession();

    useEffect(() => {
        const verifyEmail = async () => {
            const token = searchParams.get('token');

            if (!token) {
                setStatus('error');
                setError('Verification token is missing');
                return;
            }

            try {
                const response = await fetch('/api/auth/verify-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token }),
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Verification failed');
                }

                setStatus('success');

                // First update the session
                await updateSession();

                // Wait a moment to ensure the session update has propagated
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Then sign out and redirect
                await signOut({
                    redirect: false,
                });

                // Wait another moment before redirecting
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Redirect to home and trigger the login modal
                router.push('/?verified=true');
                window.dispatchEvent(
                    new CustomEvent('toggle-auth', { detail: { view: 'login' } })
                );
            } catch (error) {
                setStatus('error');
                setError(error instanceof Error ? error.message : 'Verification failed');
            }
        };

        verifyEmail();
    }, [searchParams, router, updateSession]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div className="text-center">
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                        Email Verification
                    </h2>
                    <div className="mt-4">
                        {status === 'verifying' && (
                            <div className="text-gray-600">
                                <p>Verifying your email address...</p>
                                <div className="mt-4 flex justify-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                                </div>
                            </div>
                        )}
                        {status === 'success' && (
                            <div className="text-green-600">
                                <p>Your email has been verified successfully!</p>
                                <p className="mt-2 text-sm">Redirecting to login...</p>
                            </div>
                        )}
                        {status === 'error' && (
                            <div className="text-red-600">
                                <p>Verification failed:</p>
                                <p className="mt-2">{error}</p>
                                <button
                                    onClick={() => router.push('/')}
                                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    Return to Homepage
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
} 