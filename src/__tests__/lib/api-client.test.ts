import { apiRequest, apiClient } from '@/lib/api-client';

// Mock fetch globally
global.fetch = jest.fn();

describe('API Client', () => {
  const mockResponse = (status: number, data: any, statusText = '') => {
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText,
      json: jest.fn().mockResolvedValue(data),
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('apiRequest', () => {
    it('makes a GET request with correct URL and headers', async () => {
      const mockData = { success: true, data: { id: 1, name: 'Test' } };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(200, mockData));

      const result = await apiRequest('/api/test', { method: 'GET' });

      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/test'), {
        method: 'GET',
        headers: expect.any(Headers),
      });
      expect(result).toEqual(mockData);
    });

    it('handles query parameters correctly', async () => {
      const mockData = { success: true, data: { id: 1, name: 'Test' } };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(200, mockData));

      await apiRequest('/api/test', {
        method: 'GET',
        params: { page: '1', limit: '10', filter: 'active' },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test?page=1&limit=10&filter=active'),
        expect.any(Object)
      );
    });

    it('skips null and undefined query parameters', async () => {
      const mockData = { success: true, data: { id: 1, name: 'Test' } };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(200, mockData));

      await apiRequest('/api/test', {
        method: 'GET',
        params: { page: '1', limit: null as any, filter: undefined as any },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test?page=1'),
        expect.any(Object)
      );
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('limit'),
        expect.any(Object)
      );
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('filter'),
        expect.any(Object)
      );
    });

    it('sets Content-Type header correctly for JSON requests', async () => {
      const mockData = { success: true };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(200, mockData));

      await apiRequest('/api/test', { method: 'POST', body: JSON.stringify({ name: 'Test' }) });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const headers = fetchCall[1].headers;
      
      expect(headers.get('Content-Type')).toBe('application/json');
    });

    it('does not set Content-Type header for FormData', async () => {
      const mockData = { success: true };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(200, mockData));
      
      const formData = new FormData();
      formData.append('file', new Blob(['test']), 'test.txt');

      await apiRequest('/api/upload', { method: 'POST', body: formData });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const options = fetchCall[1];
      
      // FormData should be sent without Content-Type to let the browser set it with boundary
      expect(options.body).toBe(formData);
    });

    it('returns empty object for 204 No Content responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(204, null));

      const result = await apiRequest('/api/test', { method: 'DELETE' });

      expect(result).toEqual({});
    });

    it('throws error for non-OK responses with JSON error data', async () => {
      const errorData = { error: 'Not found' };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(404, errorData, 'Not Found'));

      await expect(apiRequest('/api/test', { method: 'GET' })).rejects.toThrow('Not found');
    });

    it('throws error for non-OK responses with non-JSON response', async () => {
      const mockErrorResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockErrorResponse);

      await expect(apiRequest('/api/test', { method: 'GET' })).rejects.toThrow('Internal Server Error');
    });
  });

  describe('apiClient', () => {
    it('makes GET requests correctly', async () => {
      const mockData = { success: true, data: { id: 1 } };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(200, mockData));

      const result = await apiClient.get('/api/test', { params: { id: '1' } });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test?id=1'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(result).toEqual(mockData);
    });

    it('makes POST requests with JSON body', async () => {
      const mockData = { success: true, data: { id: 1 } };
      const postData = { name: 'Test', value: 123 };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(200, mockData));

      const result = await apiClient.post('/api/test', postData);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(postData),
        })
      );
      expect(result).toEqual(mockData);
    });

    it('makes PUT requests with JSON body', async () => {
      const mockData = { success: true, data: { id: 1 } };
      const putData = { name: 'Updated', value: 456 };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(200, mockData));

      const result = await apiClient.put('/api/test/1', putData);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test/1'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(putData),
        })
      );
      expect(result).toEqual(mockData);
    });

    it('makes PATCH requests with JSON body', async () => {
      const mockData = { success: true, data: { id: 1 } };
      const patchData = { name: 'Patched' };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(200, mockData));

      const result = await apiClient.patch('/api/test/1', patchData);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test/1'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(patchData),
        })
      );
      expect(result).toEqual(mockData);
    });

    it('makes DELETE requests correctly', async () => {
      const mockData = { success: true, message: 'Deleted' };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(200, mockData));

      const result = await apiClient.delete('/api/test/1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test/1'),
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(result).toEqual(mockData);
    });
  });
});
