import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteDomainDialog } from '@/components/delete-domain-dialog';
import { useDeleteDomain } from '@/hooks/use-domains';
import { useToast } from '@/components/ui/use-toast';

// Mock dependencies
jest.mock('@/hooks/use-domains', () => ({
  useDeleteDomain: jest.fn(),
}));

jest.mock('@/components/ui/use-toast', () => ({
  useToast: jest.fn(),
}));

// Mock lucide-react icons to prevent ESM module issues
jest.mock('lucide-react', () => ({
  Trash2: () => <div data-testid="trash-icon">Trash Icon</div>,
}));

// Mock Dialog components
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: { children: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) => (
    <div data-testid="dialog" data-open={open} onClick={() => onOpenChange && onOpenChange(!open)}>
      {children}
    </div>
  ),
  DialogTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    <div data-testid="dialog-trigger" data-as-child={asChild}>
      {children}
    </div>
  ),
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-title">{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-description">{children}</div>,
  DialogFooter: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-footer" className={className}>
      {children}
    </div>
  ),
  DialogClose: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    <div data-testid="dialog-close" data-as-child={asChild}>
      {children}
    </div>
  ),
}));

describe('DeleteDomainDialog Component', () => {
  const mockOnDeleted = jest.fn();
  const mockMutateAsync = jest.fn();
  const mockToast = { toast: jest.fn() };
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    (useDeleteDomain as jest.Mock).mockReturnValue({
      mutateAsync: mockMutateAsync,
    });
    
    (useToast as jest.Mock).mockReturnValue(mockToast);
  });

  it('renders correctly with domain information', async () => {
    render(
      <DeleteDomainDialog 
        domainId="test-domain-id" 
        domainName="example.com" 
        onDeleted={mockOnDeleted} 
      />
    );
    
    // Dialog trigger should be present
    const deleteButton = screen.getByRole('button', { name: 'Delete example.com' });
    expect(deleteButton).toBeInTheDocument();
    
    // Dialog content should not be visible initially
    expect(screen.queryByText('Delete Domain')).not.toBeInTheDocument();
    
    // Open the dialog
    const user = userEvent.setup();
    await user.click(deleteButton);
    
    // Dialog content should now be visible
    expect(screen.getByText('Delete Domain')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete the domain/)).toBeInTheDocument();
    expect(screen.getByText('example.com')).toBeInTheDocument();
    
    // Buttons should be present
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('handles successful domain deletion', async () => {
    mockMutateAsync.mockResolvedValueOnce({});
    
    render(
      <DeleteDomainDialog 
        domainId="test-domain-id" 
        domainName="example.com" 
        onDeleted={mockOnDeleted} 
      />
    );
    
    // Open the dialog
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Delete example.com' }));
    
    // Click the delete button
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    
    // Check if mutation was called with correct domain ID
    expect(mockMutateAsync).toHaveBeenCalledWith('test-domain-id');
    
    // Check if onDeleted callback was called
    await waitFor(() => {
      expect(mockOnDeleted).toHaveBeenCalled();
    });
  });

  it('handles deletion error', async () => {
    const mockError = new Error('Failed to delete domain');
    mockMutateAsync.mockRejectedValueOnce(mockError);
    
    // Mock the toast implementation to actually call the function
    mockToast.toast.mockImplementation((args) => args);
    
    // Mock console.error to prevent error output in test
    const originalConsoleError = console.error;
    console.error = jest.fn();
    
    render(
      <DeleteDomainDialog 
        domainId="test-domain-id" 
        domainName="example.com" 
        onDeleted={mockOnDeleted} 
      />
    );
    
    // Open the dialog
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Delete example.com' }));
    
    // Click the delete button
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    
    // Check if mutation was called
    expect(mockMutateAsync).toHaveBeenCalledWith('test-domain-id');
    
    // Check if error toast was shown
    await waitFor(() => {
      expect(mockToast.toast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Error',
        description: 'Failed to delete domain',
        variant: 'destructive',
      }));
    });
    
    // Check that onDeleted was not called
    expect(mockOnDeleted).not.toHaveBeenCalled();
    
    // Restore console.error
    console.error = originalConsoleError;
  });

  it('shows loading state during deletion', async () => {
    // Create a promise that we can resolve later
    let resolvePromise: (value: unknown) => void;
    const deletionPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    
    mockMutateAsync.mockReturnValueOnce(deletionPromise);
    
    render(
      <DeleteDomainDialog 
        domainId="test-domain-id" 
        domainName="example.com" 
        onDeleted={mockOnDeleted} 
      />
    );
    
    // Open the dialog
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Delete example.com' }));
    
    // Click the delete button
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    
    // Check if buttons show loading state
    expect(screen.getByRole('button', { name: 'Deleting...' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    
    // Resolve the promise to complete the deletion
    resolvePromise!({});
    
    // Wait for the deletion to complete
    await waitFor(() => {
      expect(mockOnDeleted).toHaveBeenCalled();
    });
  });

  it('closes dialog when cancel is clicked', async () => {
    render(
      <DeleteDomainDialog 
        domainId="test-domain-id" 
        domainName="example.com" 
        onDeleted={mockOnDeleted} 
      />
    );
    
    // Open the dialog
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Delete example.com' }));
    
    // Dialog should be open
    expect(screen.getByText('Delete Domain')).toBeInTheDocument();
    
    // Click the cancel button
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    
    // Dialog should be closed
    await waitFor(() => {
      expect(screen.queryByText('Delete Domain')).not.toBeInTheDocument();
    });
    
    // Mutation should not have been called
    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(mockOnDeleted).not.toHaveBeenCalled();
  });
});
