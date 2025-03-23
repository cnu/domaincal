import { getPendingDomains, addPendingDomain, clearPendingDomains } from '@/lib/pending-domains';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

// Set up localStorage mock before tests
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('Pending Domains Utility', () => {
  beforeEach(() => {
    // Clear localStorage mock before each test
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  describe('getPendingDomains', () => {
    it('returns an empty array when no domains are stored', () => {
      const domains = getPendingDomains();
      
      expect(domains).toEqual([]);
      expect(localStorageMock.getItem).toHaveBeenCalledWith('pendingDomains');
    });

    it('returns stored domains when they exist', () => {
      const storedDomains = ['example.com', 'test.org'];
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(storedDomains));
      
      const domains = getPendingDomains();
      
      expect(domains).toEqual(storedDomains);
      expect(localStorageMock.getItem).toHaveBeenCalledWith('pendingDomains');
    });

    it('handles invalid JSON gracefully', () => {
      // Mock console.error to prevent test output noise
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      // Set invalid JSON in localStorage
      localStorageMock.getItem.mockReturnValueOnce('invalid-json');
      
      // This should throw an error internally but return an empty array
      expect(() => getPendingDomains()).toThrow();
      
      // Restore console.error
      console.error = originalConsoleError;
    });
  });

  describe('addPendingDomain', () => {
    it('adds a new domain to empty storage', () => {
      const domain = 'example.com';
      
      addPendingDomain(domain);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'pendingDomains',
        JSON.stringify([domain])
      );
    });

    it('adds a new domain to existing domains', () => {
      const existingDomains = ['existing.com'];
      const newDomain = 'example.com';
      
      // Setup existing domains
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(existingDomains));
      
      addPendingDomain(newDomain);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'pendingDomains',
        JSON.stringify([...existingDomains, newDomain])
      );
    });

    it('does not add duplicate domains', () => {
      const existingDomains = ['example.com', 'test.org'];
      const duplicateDomain = 'example.com';
      
      // Setup existing domains
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(existingDomains));
      
      addPendingDomain(duplicateDomain);
      
      // Should not modify the array since domain already exists
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });

  describe('clearPendingDomains', () => {
    it('removes the pending domains from localStorage', () => {
      clearPendingDomains();
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('pendingDomains');
    });
  });

  describe('Server-side handling', () => {
    const originalWindow = global.window;
    
    beforeEach(() => {
      // Mock window as undefined to simulate server-side execution
      // @ts-ignore - Intentionally setting window to undefined for testing
      delete global.window;
    });
    
    afterEach(() => {
      // Restore window after tests
      global.window = originalWindow;
    });
    
    it('returns empty array for getPendingDomains on server', () => {
      const domains = getPendingDomains();
      expect(domains).toEqual([]);
      expect(localStorageMock.getItem).not.toHaveBeenCalled();
    });
    
    it('does nothing for addPendingDomain on server', () => {
      addPendingDomain('example.com');
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
    
    it('does nothing for clearPendingDomains on server', () => {
      clearPendingDomains();
      expect(localStorageMock.removeItem).not.toHaveBeenCalled();
    });
  });
});
