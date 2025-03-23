import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DomainInput } from '@/components/domain-input';
import { useToast } from '@/components/ui/use-toast';
import { addPendingDomain } from '@/lib/pending-domains';
import { useSession } from 'next-auth/react';

// Mock dependencies
jest.mock('@/components/ui/use-toast', () => ({
  useToast: jest.fn(),
}));

jest.mock('@/lib/pending-domains', () => ({
  addPendingDomain: jest.fn(),
}));

// Mock lucide-react icons to prevent ESM module issues
jest.mock('lucide-react', () => ({
  Plus: () => <div data-testid="plus-icon">Plus Icon</div>,
  Loader2: () => <div data-testid="loader-icon">Loader Icon</div>,
  AlertCircle: () => <div data-testid="alert-circle-icon">Alert Circle Icon</div>,
}));

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: { user: { id: 'test-user-id', name: 'Test User', email: 'test@example.com' } },
    status: 'authenticated',
  })),
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid'),
}));

describe('DomainInput Component', () => {
  const mockOnSubmit = jest.fn();
  const mockToast = { toast: jest.fn() };
  
  beforeEach(() => {
    jest.clearAllMocks();
    (useToast as jest.Mock).mockReturnValue(mockToast);
  });

  it('renders correctly', () => {
    render(<DomainInput onSubmit={mockOnSubmit} isLoading={false} />);
    
    expect(screen.getByText('Track Domain Expiry')).toBeInTheDocument();
    expect(screen.getByLabelText('Domains')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Track domains' })).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    render(<DomainInput onSubmit={mockOnSubmit} isLoading={true} />);
    
    expect(screen.getByRole('button', { name: 'Adding domains...' })).toBeDisabled();
  });

  it('validates domain input correctly', async () => {
    const user = userEvent.setup();
    render(<DomainInput onSubmit={mockOnSubmit} isLoading={false} />);
    
    const input = screen.getByLabelText('Domains');
    
    // Test invalid domain
    await user.type(input, 'invalid-domain');
    expect(screen.getByText(/Invalid domain format/)).toBeInTheDocument();
    
    // Clear and test valid domain
    await user.clear(input);
    await user.type(input, 'example.com');
    expect(screen.queryByText(/Invalid domain format/)).not.toBeInTheDocument();
  });

  it('handles domain count limit correctly', async () => {
    const user = userEvent.setup();
    // Mock the toast implementation to actually call the function
    mockToast.toast.mockImplementation((args) => args);
    
    render(<DomainInput onSubmit={mockOnSubmit} isLoading={false} />);
    
    const input = screen.getByLabelText('Domains');
    const submitButton = screen.getByRole('button', { name: 'Track domains' });
    
    // Add too many domains (over MAX_DOMAINS which is 20)
    const tooManyDomains = Array.from({ length: 25 }, (_, i) => `domain${i}.com`).join('\n');
    await user.type(input, tooManyDomains);
    
    // Check for the domain count indicator with "too many" text
    const countIndicator = screen.getByText(/25\/20 domains/);
    expect(countIndicator).toHaveClass('text-destructive');
    
    // Try to submit
    await user.click(submitButton);
    
    // Verify toast was called with correct arguments
    expect(mockToast.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Validation Error',
      description: expect.stringContaining('Maximum 20 domains allowed'),
      variant: 'destructive',
    }));
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('submits valid domains successfully', async () => {
    const user = userEvent.setup();
    render(<DomainInput onSubmit={mockOnSubmit} isLoading={false} />);
    
    const input = screen.getByLabelText('Domains');
    const submitButton = screen.getByRole('button', { name: 'Track domains' });
    
    // Add valid domains
    await user.type(input, 'example.com\ndomain.org');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(['example.com', 'domain.org']);
    });
  });

  it('handles empty input', async () => {
    const user = userEvent.setup();
    render(<DomainInput onSubmit={mockOnSubmit} isLoading={false} />);
    
    const submitButton = screen.getByRole('button', { name: 'Track domains' });
    
    // Try to submit with empty input
    await user.click(submitButton);
    
    expect(mockToast.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Error',
      description: 'Please enter at least one domain',
      variant: 'destructive',
    }));
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('handles non-authenticated users correctly', async () => {
    // Mock session as null (not authenticated)
    (useSession as jest.Mock).mockReturnValue({
      data: null,
      status: 'unauthenticated',
    });
    
    // Mock the addPendingDomain implementation
    (addPendingDomain as jest.Mock).mockImplementation((domain) => domain);
    
    const user = userEvent.setup();
    
    // Mock window.dispatchEvent
    const dispatchEventSpy = jest.spyOn(window, 'dispatchEvent');
    
    render(<DomainInput onSubmit={mockOnSubmit} isLoading={false} />);
    
    const input = screen.getByLabelText('Domains');
    const submitButton = screen.getByRole('button', { name: 'Track domains' });
    
    // Enter a valid domain
    await user.type(input, 'example.com');
    await user.click(submitButton);
    
    // Should add to pending domains and dispatch event
    expect(addPendingDomain).toHaveBeenCalledWith('example.com');
    expect(mockOnSubmit).not.toHaveBeenCalled();
    
    // Mock the dispatchEvent
    expect(dispatchEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'toggle-auth',
        detail: expect.objectContaining({ view: 'register' }),
      })
    );
    
    dispatchEventSpy.mockRestore();
  });

  it('handles submission errors', async () => {
    const mockError = new Error('API error');
    mockOnSubmit.mockRejectedValueOnce(mockError);
    
    const user = userEvent.setup();
    render(<DomainInput onSubmit={mockOnSubmit} isLoading={false} />);
    
    const input = screen.getByLabelText('Domains');
    const submitButton = screen.getByRole('button', { name: 'Track domains' });
    
    // Add valid domain and submit
    await user.type(input, 'example.com');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockToast.toast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Error',
        description: 'API error',
        variant: 'destructive',
      }));
    });
  });
});
