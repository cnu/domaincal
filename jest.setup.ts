import '@testing-library/jest-dom';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    pathname: '/',
    query: {},
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: { user: { id: 'test-user-id', name: 'Test User', email: 'test@example.com' } },
    status: 'authenticated',
  })),
  signIn: jest.fn(),
  signOut: jest.fn(),
  getSession: jest.fn(),
}));

// Mock date-fns to avoid date-related issues in tests
jest.mock('date-fns', () => ({
  ...jest.requireActual('date-fns'),
  formatDistanceToNow: jest.fn(() => '5 minutes'),
  format: jest.fn((date, format) => {
    if (format === 'dd MMM') return '01 Jan';
    if (format === 'yyyy') return '2025';
    return '01 Jan 2025';
  }),
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid'),
}));

// Mock normalize-url and psl for domain validation tests
jest.mock('normalize-url', () => ({
  __esModule: true,
  default: jest.fn((url) => {
    // Simple mock implementation
    return url.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  }),
}));

jest.mock('psl', () => ({
  __esModule: true,
  parse: jest.fn((domain) => {
    // Simple mock implementation for common domains
    if (domain.includes('example.com')) {
      const parts = domain.split('.');
      if (parts.length > 2) {
        return {
          domain: 'example.com',
          subdomain: parts.slice(0, parts.length - 2).join('.'),
        };
      }
      return { domain: 'example.com', subdomain: '' };
    }
    if (domain.includes('test.org')) {
      return { domain: 'test.org', subdomain: '' };
    }
    // For invalid domains
    return { domain: null };
  }),
}));

// Mock window methods
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
  writable: true,
});

// Suppress React 18 console errors/warnings
const originalConsoleError = console.error;
console.error = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('ReactDOM.render is no longer supported') ||
      args[0].includes('Warning: ReactDOM.render'))
  ) {
    return;
  }
  originalConsoleError(...args);
};
