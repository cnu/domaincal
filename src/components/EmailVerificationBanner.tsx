'use client';

import { useState } from 'react';
import { useToast } from "@/components/ui/use-toast";

// No need for props as we use user ID from session in the API call
export default function EmailVerificationBanner() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleResendVerification = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // This ensures cookies (including session) are sent with the request
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend verification email');
      }
      
      toast({
        id: 'email-verification-success',
        description: 'Verification email sent. Please check your inbox for the verification link',
      });
    } catch (error) {
      console.error('Error resending verification:', error);
      toast({
        id: 'email-verification-error',
        description: error instanceof Error ? error.message : 'Failed to resend verification email',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-800 p-4 w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <svg
            className="h-5 w-5 mr-2"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <p>
            Please verify your email address to access all features.
          </p>
        </div>
        <button
          onClick={handleResendVerification}
          disabled={isLoading}
          className="ml-4 bg-amber-600 hover:bg-amber-700 text-white py-1 px-3 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Sending...' : 'Resend verification email'}
        </button>
      </div>
    </div>
  );
}
