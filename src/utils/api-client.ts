/**
 * API Client for handling API requests consistently
 * Provides methods for common HTTP operations with standardized error handling
 */

export interface ApiClientOptions {
  baseUrl?: string;
  headers?: Record<string, string>;
}

export interface ApiErrorResponse {
  error?: string;
  message?: string;
  details?: unknown;
  status?: number;
}

export class ApiError extends Error {
  status: number;
  details?: unknown;
  
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl || '';
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
  }

  /**
   * Make a GET request
   * @param url Endpoint URL
   * @param headers Optional additional headers
   */
  async get<T>(url: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>('GET', url, undefined, headers);
  }

  /**
   * Make a POST request
   * @param url Endpoint URL
   * @param data Request body data
   * @param headers Optional additional headers 
   */
  async post<T>(url: string, data?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>('POST', url, data, headers);
  }

  /**
   * Make a PUT request
   * @param url Endpoint URL
   * @param data Request body data
   * @param headers Optional additional headers
   */
  async put<T>(url: string, data?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>('PUT', url, data, headers);
  }

  /**
   * Make a PATCH request
   * @param url Endpoint URL
   * @param data Request body data
   * @param headers Optional additional headers
   */
  async patch<T>(url: string, data?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>('PATCH', url, data, headers);
  }

  /**
   * Make a DELETE request
   * @param url Endpoint URL
   * @param data Optional request body data
   * @param headers Optional additional headers
   */
  async delete<T>(url: string, data?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>('DELETE', url, data, headers);
  }

  /**
   * Make a generic request with standardized error handling
   * @param method HTTP method
   * @param url Endpoint URL
   * @param data Optional request body data
   * @param headers Optional additional headers
   */
  private async request<T>(
    method: string,
    url: string,
    data?: unknown,
    headers?: Record<string, string>
  ): Promise<T> {
    const fullUrl = this.baseUrl + url;
    const requestHeaders = {
      ...this.defaultHeaders,
      ...headers,
    };

    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
      credentials: 'same-origin',
    };

    if (data !== undefined) {
      requestOptions.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(fullUrl, requestOptions);
      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');
      const responseData = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        const errorMessage = isJson
          ? responseData.error || responseData.message || `HTTP error ${response.status}`
          : `HTTP error ${response.status}`;

        throw new ApiError(errorMessage, response.status, responseData.details);
      }

      return responseData as T;
    } catch (error) {
      // If it's already an ApiError, just rethrow it
      if (error instanceof ApiError) {
        throw error;
      }

      // For network errors or other fetch errors
      if (error instanceof Error) {
        throw new ApiError(
          error.message || 'Network error',
          0, // 0 indicates a network/client error, not an HTTP status code
          error
        );
      }

      // For unknown errors
      throw new ApiError('Unknown error occurred', 0, error);
    }
  }
}

// Create a singleton instance for use throughout the application
export const apiClient = new ApiClient();
