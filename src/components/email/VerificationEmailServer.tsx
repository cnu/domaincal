import * as React from 'react';

interface EmailTemplateProps {
  verificationUrl: string;
}

// This is a server component for email templates
export const VerificationEmailServer = ({
  verificationUrl,
}: EmailTemplateProps) => {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', lineHeight: '1.5' }}>
      <h1 style={{ color: '#333', fontSize: '24px' }}>Welcome to DomainCal!</h1>
      
      <p style={{ fontSize: '16px', color: '#555' }}>
        Thank you for registering with DomainCal. To complete your registration and access all features, 
        please verify your email address by clicking the button below:
      </p>
      
      <div style={{ textAlign: 'center', margin: '30px 0' }}>
        <a 
          href={verificationUrl} 
          style={{
            backgroundColor: '#4F46E5',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '4px',
            textDecoration: 'none',
            fontWeight: 'bold',
            display: 'inline-block',
          }}
        >
          Verify My Email
        </a>
      </div>
      
      <p style={{ fontSize: '16px', color: '#555' }}>
        If you did not create an account with DomainCal, you can safely ignore this email.
      </p>
      
      <div style={{ marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '20px', fontSize: '14px', color: '#888' }}>
        <p>&#x00A9; {new Date().getFullYear()} DomainCal. All rights reserved.</p>
      </div>
    </div>
  );
};
