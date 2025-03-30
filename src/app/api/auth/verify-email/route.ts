import { type NextRequest, NextResponse } from 'next/server';
import { emailVerificationService } from '@/services/email-verification.service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');
    
    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      );
    }
    
    const success = await emailVerificationService.verifyEmail(token);
    
    if (!success) {
      return NextResponse.redirect(
        new URL('/?verificationStatus=failed', request.url)
      );
    }
    
    // Redirect to the home page with verification success parameter
    return NextResponse.redirect(
      new URL('/?verificationStatus=success', request.url)
    );
  } catch (error) {
    console.error('Error verifying email:', error);
    return NextResponse.json(
      { error: 'An error occurred during email verification' },
      { status: 500 }
    );
  }
}
