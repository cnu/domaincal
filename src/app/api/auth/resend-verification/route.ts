import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { emailVerificationService } from '@/services/email-verification.service';

export async function POST() {
  try {
    // Get the authenticated user's session
    const session = await getServerSession(authOptions) as Session | null;
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Get the user record
    const user = await prisma.user.findUnique({
      where: { id: BigInt(session.user.id) }
    });
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // If email is already verified, no need to resend
    if (user.emailVerified) {
      return NextResponse.json(
        { message: 'Email already verified' },
        { status: 200 }
      );
    }
    
    // Send the verification email
    const success = await emailVerificationService.sendVerificationEmail({
      userId: user.id.toString(),
      email: user.email
    });
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to send verification email' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { message: 'Verification email sent successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error resending verification email:', error);
    return NextResponse.json(
      { error: 'An error occurred while resending verification email' },
      { status: 500 }
    );
  }
}
