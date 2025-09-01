/**
 * AstralTube v3 - AstralTubeAPI Unit Tests
 * Comprehensive tests for YouTube API interactions and data management
 */

import { AstralTubeAPI } from '../../src/lib/api.js';
import { chromeMocks, chromeTestUtils } from '../mocks/chrome-api.js';
import { youTubeAPIMocks, createYouTubeAPIFetchMock } from '../mocks/youtube-api.js';

describe('AstralTubeAPI', () => {
  let api;
  
  beforeEach(async () => {
    // Reset all mocks
    chromeTestUtils.resetMocks();
    youTubeAPIMocks.resetMocks();
    fetch.mockClear();
    
    // Create new API instance
    api = new AstralTubeAPI();
  });

  afterEach(() => {
    api = null;
  });

  describe('Constructor', () => {
    test('should initialize with default values', () => {
      expect(api.baseURL).toBe('https://www.googleapis.com/youtube/v3');
      expect(api.apiKey).toBeNull();
      expect(api.accessToken).toBeNull();
      expect(api.rateLimiter).toBeDefined();
      expect(api.cache).toBeInstanceOf(Map);
      expect(api.initialized).toBe(false);
    });
  });

  describe('initialize()', () => {
    test('should initialize successfully with stored credentials', async () => {
      const mockCredentials = {
        apiKey: 'test-api-key',
        accessToken: 'test-access-token'
      };
      
      chromeMocks.storage.local.get.mockResolvedValueOnce(mockCredentials);
      chromeMocks.runtime.getManifest.mockReturnValueOnce({
        oauth2: { client_id: 'test-client-id' }
      });
      
      await api.initialize();
      
      expect(api.apiKey).toBe(mockCredentials.apiKey);
      expect(api.accessToken).toBe(mockCredentials.accessToken);
      expect(api.initialized).toBe(true);
    });

    test('should initialize OAuth when no access token is stored', async () => {
      chromeMocks.storage.local.get.mockResolvedValueOnce({
        apiKey: 'test-api-key'
        // No accessToken
      });
      
      chromeMocks.runtime.getManifest.mockReturnValueOnce({
        oauth2: { client_id: 'test-client-id' }
      });
      
      chromeMocks.identity.getAuthToken.mockResolvedValueOnce('new-access-token');
      
      await api.initialize();
      
      expect(chromeMocks.identity.getAuthToken).toHaveBeenCalledWith({ interactive: true });
      expect(api.accessToken).toBe('new-access-token');
      expect(chromeMocks.storage.local.set).toHaveBeenCalledWith({
        accessToken: 'new-access-token'
      });
    });

    test('should handle OAuth configuration missing', async () => {
      chromeMocks.storage.local.get.mockResolvedValueOnce({});
      chromeMocks.runtime.getManifest.mockReturnValueOnce({
        // No oauth2 configuration
      });
      
      await api.initialize();
      
      expect(api.initialized).toBe(true);
      expect(chromeMocks.identity.getAuthToken).not.toHaveBeenCalled();
    });

    test('should handle initialization errors gracefully', async () => {
      chromeMocks.storage.local.get.mockRejectedValueOnce(new Error('Storage error'));
      
      await api.initialize();
      
      expect(api.initialized).toBe(true); // Should still mark as initialized
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(async () => {
      await api.initialize();
      api.apiKey = 'test-api-key';
    });

    test('should respect rate limits', async () => {
      const response = { items: [], pageInfo: { totalResults: 0 } };
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(response)
      });
      
      // Make multiple rapid requests
      const promises = Array(5).fill(0).map(() => 
        api.searchVideos('test query')
      );
      
      await Promise.all(promises);
      
      // Should have been rate limited (fewer actual fetch calls than requests)
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('should handle rate limit exceeded errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve({
          error: { code: 429, message: 'Rate limit exceeded' }
        })
      });
      
      await expect(api.searchVideos('test query')).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('searchVideos()', () => {
    beforeEach(async () => {
      await api.initialize();
      api.apiKey = 'test-api-key';
    });

    test('should search for videos successfully', async () => {
      const mockResponse = {
        items: [
          {
            id: { videoId: 'test123' },
            snippet: {
              title: 'Test Video',
              description: 'Test Description',
              channelTitle: 'Test Channel'
            }
          }
        ],
        pageInfo: { totalResults: 1 },
        nextPageToken: 'next123'
      };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      });
      
      const result = await api.searchVideos('test query', { maxResults: 10 });
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/youtube/v3/search'),
        expect.objectContaining({
          method: 'GET'
        })
      );
      
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id.videoId).toBe('test123');
      expect(result.nextPageToken).toBe('next123');
    });

    test('should use cached results for repeated searches', async () => {
      const mockResponse = {
        items: [{ id: { videoId: 'cached123' } }],
        pageInfo: { totalResults: 1 }
      };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      });
      
      // First call
      await api.searchVideos('cached query');
      
      // Second call with same query
      const result = await api.searchVideos('cached query');
      
      expect(fetch).toHaveBeenCalledTimes(1); // Should use cache for second call
      expect(result.items[0].id.videoId).toBe('cached123');
    });

    test('should handle search errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          error: { code: 400, message: 'Bad request' }
        })
      });
      
      await expect(api.searchVideos('invalid query')).rejects.toThrow('Bad request');
    });
  });

  describe('getVideoDetails()', () => {
    beforeEach(async () => {
      await api.initialize();
      api.apiKey = 'test-api-key';
    });

    test('should get video details for single video', async () => {
      const mockResponse = {
        items: [{
          id: 'test123',
          snippet: {
            title: 'Test Video',
            description: 'Test Description',
            channelTitle: 'Test Channel'
          },
          statistics: {
            viewCount: '1000',
            likeCount: '100'
          }
        }],
        pageInfo: { totalResults: 1 }
      };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      });
      
      const result = await api.getVideoDetails('test123');
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/youtube/v3/videos'),
        expect.objectContaining({
          method: 'GET'
        })
      );
      
      expect(result.items[0].id).toBe('test123');
      expect(result.items[0].statistics.viewCount).toBe('1000');
    });

    test('should get video details for multiple videos', async () => {
      const videoIds = ['video1', 'video2', 'video3'];
      const mockResponse = {
        items: videoIds.map(id => ({
          id,
          snippet: { title: `Video ${id}` },
          statistics: { viewCount: '1000' }
        })),
        pageInfo: { totalResults: 3 }
      };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      });
      
      const result = await api.getVideoDetails(videoIds);
      
      expect(result.items).toHaveLength(3);
      expect(result.items.map(item => item.id)).toEqual(videoIds);
    });

    test('should handle video not found', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          items: [], // Empty items array means video not found
          pageInfo: { totalResults: 0 }
        })
      });
      
      const result = await api.getVideoDetails('nonexistent123');
      
      expect(result.items).toHaveLength(0);
    });
  });

  describe('getPlaylists()', () => {
    beforeEach(async () => {
      await api.initialize();
      api.apiKey = 'test-api-key';
      api.accessToken = 'test-access-token';
    });

    test('should get user playlists', async () => {
      const mockResponse = {
        items: [{
          id: 'playlist123',
          snippet: {
            title: 'My Playlist',
            description: 'My test playlist'
          },
          contentDetails: {
            itemCount: 10
          }
        }],
        pageInfo: { totalResults: 1 }
      };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      });
      
      const result = await api.getPlaylists();
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/youtube/v3/playlists'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-access-token'
          })
        })
      );
      
      expect(result.items[0].id).toBe('playlist123');
    });

    test('should get playlists for specific channel', async () => {
      const channelId = 'UCTestChannel';
      const mockResponse = {
        items: [{
          id: 'channelPlaylist123',
          snippet: {
            title: 'Channel Playlist',
            channelId
          }
        }],
        pageInfo: { totalResults: 1 }
      };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      });
      
      const result = await api.getPlaylists({ channelId });
      
      expect(result.items[0].snippet.channelId).toBe(channelId);
    });

    test('should require authentication for user playlists', async () => {
      api.accessToken = null; // No access token
      
      await expect(api.getPlaylists()).rejects.toThrow('Authentication required');
    });
  });

  describe('createPlaylist()', () => {
    beforeEach(async () => {
      await api.initialize();
      api.apiKey = 'test-api-key';
      api.accessToken = 'test-access-token';
    });

    test('should create playlist successfully', async () => {
      const playlistData = {
        title: 'New Playlist',
        description: 'A new test playlist',
        privacyStatus: 'private'
      };
      
      const mockResponse = {
        id: 'newPlaylist123',
        snippet: playlistData,
        status: { privacyStatus: 'private' }
      };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      });
      
      const result = await api.createPlaylist(playlistData);
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/youtube/v3/playlists'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-access-token',
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining(playlistData.title)
        })
      );
      
      expect(result.id).toBe('newPlaylist123');
    });

    test('should require authentication', async () => {
      api.accessToken = null;
      
      await expect(api.createPlaylist({
        title: 'Test Playlist'
      })).rejects.toThrow('Authentication required');
    });
  });

  describe('addToPlaylist()', () => {
    beforeEach(async () => {
      await api.initialize();
      api.apiKey = 'test-api-key';
      api.accessToken = 'test-access-token';
    });

    test('should add video to playlist successfully', async () => {
      const playlistId = 'playlist123';
      const videoId = 'video123';
      
      const mockResponse = {
        id: 'playlistItem123',
        snippet: {
          playlistId,
          resourceId: { videoId }
        }
      };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      });
      
      const result = await api.addToPlaylist(playlistId, videoId);
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/youtube/v3/playlistItems'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-access-token'
          })
        })
      );
      
      expect(result.snippet.playlistId).toBe(playlistId);
      expect(result.snippet.resourceId.videoId).toBe(videoId);
    });

    test('should handle duplicate video in playlist', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () => Promise.resolve({
          error: {
            code: 409,
            message: 'Video already exists in playlist'
          }
        })
      });
      
      await expect(api.addToPlaylist('playlist123', 'video123'))
        .rejects.toThrow('Video already exists in playlist');
    });
  });

  describe('getSubscriptions()', () => {
    beforeEach(async () => {
      await api.initialize();
      api.apiKey = 'test-api-key';
      api.accessToken = 'test-access-token';
    });

    test('should get user subscriptions', async () => {
      const mockResponse = {
        items: [{
          id: 'sub123',
          snippet: {
            title: 'Subscribed Channel',
            resourceId: {
              channelId: 'UCSubscribed123'
            }
          }
        }],
        pageInfo: { totalResults: 1 }
      };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      });
      
      const result = await api.getSubscriptions();
      
      expect(result.items[0].snippet.title).toBe('Subscribed Channel');
    });

    test('should require authentication', async () => {
      api.accessToken = null;
      
      await expect(api.getSubscriptions()).rejects.toThrow('Authentication required');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await api.initialize();
      api.apiKey = 'test-api-key';
    });

    test('should handle network errors', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));
      
      await expect(api.searchVideos('test')).rejects.toThrow('Network error');
    });

    test('should handle API quota exceeded', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({
          error: {
            code: 403,
            message: 'The request cannot be completed because you have exceeded your quota.'
          }
        })
      });
      
      await expect(api.searchVideos('test')).rejects.toThrow('exceeded your quota');
    });

    test('should handle invalid API key', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          error: {
            code: 400,
            message: 'API key not valid'
          }
        })
      });
      
      await expect(api.searchVideos('test')).rejects.toThrow('API key not valid');
    });
  });

  describe('Caching', () => {
    beforeEach(async () => {
      await api.initialize();
      api.apiKey = 'test-api-key';
    });

    test('should cache API responses', async () => {
      const mockResponse = {
        items: [{ id: 'cached123' }],
        pageInfo: { totalResults: 1 }
      };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      });
      
      // First call
      await api.searchVideos('cache test');
      
      // Second call should use cache
      const result = await api.searchVideos('cache test');
      
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(result.items[0].id).toBe('cached123');
    });

    test('should respect cache expiration', async () => {
      // Mock a response with short cache time
      const mockResponse = {
        items: [{ id: 'expired123' }],
        pageInfo: { totalResults: 1 }
      };
      
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      });
      
      // First call
      await api.searchVideos('expire test');
      
      // Simulate cache expiration by advancing time
      jest.advanceTimersByTime(10 * 60 * 1000); // 10 minutes
      
      // Second call should make new request
      await api.searchVideos('expire test');
      
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    test('should clear cache on demand', async () => {
      const mockResponse = {
        items: [{ id: 'clear123' }],
        pageInfo: { totalResults: 1 }
      };
      
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      });
      
      await api.searchVideos('clear test');
      
      // Clear cache
      api.clearCache();
      
      // Should make new request after cache clear
      await api.searchVideos('clear test');
      
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });
});