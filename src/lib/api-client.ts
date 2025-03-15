/**
 * API Client for making requests to the backend
 * This ensures consistent API calls throughout the application
 */

const getBaseUrl = () => {
  // In the browser, use the current window location
  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
  }

  // In server-side rendering, use environment variable or default
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";
};

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
}

/**
 * Makes a fetch request to the API
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, ...fetchOptions } = options;

  // Build the URL with query parameters if provided
  let url = `${getBaseUrl()}${endpoint}`;
  if (params) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value);
      }
    });
    const queryString = queryParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  // Set default headers
  const headers = new Headers(fetchOptions.headers);
  if (
    !headers.has("Content-Type") &&
    !(fetchOptions.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  // Make the request
  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  // Handle response
  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
      errorData = { error: response.statusText };
    }
    throw new Error(errorData.error || "API request failed");
  }

  // Return JSON response or empty object if no content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

/**
 * API client with methods for common HTTP verbs
 */
export const apiClient = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(
    endpoint: string,
    data?: Record<string, unknown>,
    options?: RequestOptions
  ) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(
    endpoint: string,
    data?: Record<string, unknown>,
    options?: RequestOptions
  ) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(
    endpoint: string,
    data?: Record<string, unknown>,
    options?: RequestOptions
  ) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: "DELETE" }),
};
