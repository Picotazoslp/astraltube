/**
 * AstralTube v3 - YouTube API Mocks
 * Mock responses for YouTube Data API v3 endpoints
 */

// Mock video data
const mockVideoData = {
  kind: 'youtube#video',
  etag: 'mock-etag-123',
  id: 'test123',
  snippet: {
    publishedAt: '2024-01-01T12:00:00Z',
    channelId: 'UCTestChannel',
    title: 'Test YouTube Video',
    description: 'This is a test video description for unit testing.',
    thumbnails: {
      default: { url: 'https://i.ytimg.com/vi/test123/default.jpg', width: 120, height: 90 },
      medium: { url: 'https://i.ytimg.com/vi/test123/mqdefault.jpg', width: 320, height: 180 },
      high: { url: 'https://i.ytimg.com/vi/test123/hqdefault.jpg', width: 480, height: 360 }
    },
    channelTitle: 'Test Channel',
    tags: ['test', 'video', 'youtube'],
    categoryId: '22',
    liveBroadcastContent: 'none',
    defaultLanguage: 'en',
    localized: {
      title: 'Test YouTube Video',
      description: 'This is a test video description for unit testing.'
    }
  },
  statistics: {
    viewCount: '1000000',
    likeCount: '50000',
    dislikeCount: '1000',
    favoriteCount: '0',
    commentCount: '5000'
  },
  status: {
    uploadStatus: 'processed',
    privacyStatus: 'public',
    license: 'youtube',
    embeddable: true,
    publicStatsViewable: true
  }
};

// Mock playlist data
const mockPlaylistData = {
  kind: 'youtube#playlist',
  etag: 'mock-playlist-etag-456',
  id: 'PLTest123',
  snippet: {
    publishedAt: '2024-01-01T12:00:00Z',
    channelId: 'UCTestChannel',
    title: 'Test Playlist',
    description: 'This is a test playlist for unit testing.',
    thumbnails: {
      default: { url: 'https://i.ytimg.com/vi/test123/default.jpg', width: 120, height: 90 },
      medium: { url: 'https://i.ytimg.com/vi/test123/mqdefault.jpg', width: 320, height: 180 },
      high: { url: 'https://i.ytimg.com/vi/test123/hqdefault.jpg', width: 480, height: 360 }
    },
    channelTitle: 'Test Channel',
    defaultLanguage: 'en',
    localized: {
      title: 'Test Playlist',
      description: 'This is a test playlist for unit testing.'
    }
  },
  status: {
    privacyStatus: 'public'
  },
  contentDetails: {
    itemCount: 10
  }
};

// Mock channel data
const mockChannelData = {
  kind: 'youtube#channel',
  etag: 'mock-channel-etag-789',
  id: 'UCTestChannel',
  snippet: {
    title: 'Test Channel',
    description: 'This is a test channel for unit testing.',
    customUrl: '@testchannel',
    publishedAt: '2020-01-01T12:00:00Z',
    thumbnails: {
      default: { url: 'https://yt3.ggpht.com/test/default.jpg', width: 88, height: 88 },
      medium: { url: 'https://yt3.ggpht.com/test/medium.jpg', width: 240, height: 240 },
      high: { url: 'https://yt3.ggpht.com/test/high.jpg', width: 800, height: 800 }
    },
    defaultLanguage: 'en',
    localized: {
      title: 'Test Channel',
      description: 'This is a test channel for unit testing.'
    }
  },
  statistics: {
    viewCount: '10000000',
    subscriberCount: '100000',
    hiddenSubscriberCount: false,
    videoCount: '500'
  },
  contentDetails: {
    relatedPlaylists: {
      likes: '',
      favorites: '',
      uploads: 'UUTestChannel',
      watchHistory: 'HL',
      watchLater: 'WL'
    }
  }
};

// Mock subscription data
const mockSubscriptionData = {
  kind: 'youtube#subscription',
  etag: 'mock-subscription-etag-101',
  id: 'subscription-test-id',
  snippet: {
    publishedAt: '2024-01-01T12:00:00Z',
    channelTitle: 'Test Channel',
    title: 'Test Channel',
    description: '',
    resourceId: {
      kind: 'youtube#channel',
      channelId: 'UCTestChannel'
    },
    channelId: 'UCMyChannel',
    thumbnails: {
      default: { url: 'https://yt3.ggpht.com/test/default.jpg', width: 88, height: 88 },
      medium: { url: 'https://yt3.ggpht.com/test/medium.jpg', width: 240, height: 240 },
      high: { url: 'https://yt3.ggpht.com/test/high.jpg', width: 800, height: 800 }
    }
  },
  contentDetails: {
    totalItemCount: 500,
    newItemCount: 5,
    activityType: 'all'
  }
};

// API Response generators
const createAPIResponse = (items, nextPageToken = null, totalResults = null) => ({
  kind: 'youtube#searchListResponse',
  etag: 'mock-response-etag',
  nextPageToken,
  regionCode: 'US',
  pageInfo: {
    totalResults: totalResults || items.length,
    resultsPerPage: items.length
  },
  items
});

// YouTube API Mock Implementation
export const youTubeAPIMocks = {
  // Videos endpoint
  videos: {
    list: jest.fn((params) => {
      const { part, id, chart, maxResults = 5 } = params;
      
      if (chart === 'mostPopular') {
        return Promise.resolve(createAPIResponse(
          Array(maxResults).fill(0).map((_, i) => ({
            ...mockVideoData,
            id: `popular${i + 1}`,
            snippet: {
              ...mockVideoData.snippet,
              title: `Popular Video ${i + 1}`
            }
          }))
        ));
      }
      
      if (id) {
        const ids = Array.isArray(id) ? id : id.split(',');
        return Promise.resolve(createAPIResponse(
          ids.map(videoId => ({
            ...mockVideoData,
            id: videoId,
            snippet: {
              ...mockVideoData.snippet,
              title: `Video ${videoId}`
            }
          }))
        ));
      }
      
      return Promise.resolve(createAPIResponse([mockVideoData]));
    })
  },
  
  // Playlists endpoint
  playlists: {
    list: jest.fn((params) => {
      const { part, id, channelId, mine, maxResults = 5 } = params;
      
      if (mine) {
        return Promise.resolve(createAPIResponse(
          Array(maxResults).fill(0).map((_, i) => ({
            ...mockPlaylistData,
            id: `PLMine${i + 1}`,
            snippet: {
              ...mockPlaylistData.snippet,
              title: `My Playlist ${i + 1}`
            }
          }))
        ));
      }
      
      if (channelId) {
        return Promise.resolve(createAPIResponse(
          Array(maxResults).fill(0).map((_, i) => ({
            ...mockPlaylistData,
            id: `PLChannel${i + 1}`,
            snippet: {
              ...mockPlaylistData.snippet,
              title: `Channel Playlist ${i + 1}`,
              channelId
            }
          }))
        ));
      }
      
      if (id) {
        const ids = Array.isArray(id) ? id : id.split(',');
        return Promise.resolve(createAPIResponse(
          ids.map(playlistId => ({
            ...mockPlaylistData,
            id: playlistId,
            snippet: {
              ...mockPlaylistData.snippet,
              title: `Playlist ${playlistId}`
            }
          }))
        ));
      }
      
      return Promise.resolve(createAPIResponse([mockPlaylistData]));
    }),
    
    insert: jest.fn((params) => {
      return Promise.resolve({
        ...mockPlaylistData,
        id: `PLNew${Date.now()}`,
        snippet: {
          ...mockPlaylistData.snippet,
          title: params.resource.snippet.title,
          description: params.resource.snippet.description || ''
        }
      });
    }),
    
    update: jest.fn((params) => {
      return Promise.resolve({
        ...mockPlaylistData,
        id: params.resource.id,
        snippet: {
          ...mockPlaylistData.snippet,
          title: params.resource.snippet.title,
          description: params.resource.snippet.description || ''
        }
      });
    }),
    
    delete: jest.fn(() => Promise.resolve())
  },
  
  // Playlist items endpoint
  playlistItems: {
    list: jest.fn((params) => {
      const { part, playlistId, maxResults = 5 } = params;
      
      return Promise.resolve(createAPIResponse(
        Array(maxResults).fill(0).map((_, i) => ({
          kind: 'youtube#playlistItem',
          etag: `mock-item-etag-${i}`,
          id: `item${i + 1}`,
          snippet: {
            publishedAt: '2024-01-01T12:00:00Z',
            channelId: 'UCTestChannel',
            title: `Video ${i + 1} in playlist`,
            description: `Description for video ${i + 1}`,
            thumbnails: mockVideoData.snippet.thumbnails,
            channelTitle: 'Test Channel',
            playlistId,
            position: i,
            resourceId: {
              kind: 'youtube#video',
              videoId: `video${i + 1}`
            }
          },
          contentDetails: {
            videoId: `video${i + 1}`,
            startAt: 'PT0S',
            endAt: 'PT0S',
            note: '',
            videoPublishedAt: '2024-01-01T12:00:00Z'
          }
        }))
      ));
    }),
    
    insert: jest.fn((params) => {
      return Promise.resolve({
        kind: 'youtube#playlistItem',
        etag: 'mock-new-item-etag',
        id: `newItem${Date.now()}`,
        snippet: {
          publishedAt: new Date().toISOString(),
          channelId: 'UCTestChannel',
          title: 'New Video Added',
          thumbnails: mockVideoData.snippet.thumbnails,
          channelTitle: 'Test Channel',
          playlistId: params.resource.snippet.playlistId,
          position: 0,
          resourceId: params.resource.snippet.resourceId
        }
      });
    }),
    
    update: jest.fn((params) => {
      return Promise.resolve({
        ...params.resource,
        etag: 'mock-updated-item-etag'
      });
    }),
    
    delete: jest.fn(() => Promise.resolve())
  },
  
  // Channels endpoint
  channels: {
    list: jest.fn((params) => {
      const { part, id, mine, forUsername, maxResults = 5 } = params;
      
      if (mine) {
        return Promise.resolve(createAPIResponse([{
          ...mockChannelData,
          id: 'UCMyChannel',
          snippet: {
            ...mockChannelData.snippet,
            title: 'My Channel'
          }
        }]));
      }
      
      if (forUsername) {
        return Promise.resolve(createAPIResponse([{
          ...mockChannelData,
          id: 'UCUsernameChannel',
          snippet: {
            ...mockChannelData.snippet,
            title: forUsername,
            customUrl: `@${forUsername.toLowerCase()}`
          }
        }]));
      }
      
      if (id) {
        const ids = Array.isArray(id) ? id : id.split(',');
        return Promise.resolve(createAPIResponse(
          ids.map(channelId => ({
            ...mockChannelData,
            id: channelId,
            snippet: {
              ...mockChannelData.snippet,
              title: `Channel ${channelId}`
            }
          }))
        ));
      }
      
      return Promise.resolve(createAPIResponse([mockChannelData]));
    })
  },
  
  // Subscriptions endpoint
  subscriptions: {
    list: jest.fn((params) => {
      const { part, mine, channelId, maxResults = 5 } = params;
      
      return Promise.resolve(createAPIResponse(
        Array(maxResults).fill(0).map((_, i) => ({
          ...mockSubscriptionData,
          id: `sub${i + 1}`,
          snippet: {
            ...mockSubscriptionData.snippet,
            title: `Subscribed Channel ${i + 1}`,
            channelTitle: `Subscribed Channel ${i + 1}`,
            resourceId: {
              kind: 'youtube#channel',
              channelId: `UCSubscribed${i + 1}`
            }
          }
        }))
      ));
    }),
    
    insert: jest.fn((params) => {
      return Promise.resolve({
        ...mockSubscriptionData,
        id: `newSub${Date.now()}`,
        snippet: {
          ...mockSubscriptionData.snippet,
          resourceId: params.resource.snippet.resourceId
        }
      });
    }),
    
    delete: jest.fn(() => Promise.resolve())
  },
  
  // Search endpoint
  search: {
    list: jest.fn((params) => {
      const { part, q, type, channelId, maxResults = 5, order = 'relevance' } = params;
      
      const searchResults = Array(maxResults).fill(0).map((_, i) => ({
        kind: `youtube#searchResult`,
        etag: `mock-search-etag-${i}`,
        id: {
          kind: type === 'playlist' ? 'youtube#playlist' : 'youtube#video',
          videoId: type === 'video' ? `search${i + 1}` : undefined,
          playlistId: type === 'playlist' ? `PLSearch${i + 1}` : undefined,
          channelId: type === 'channel' ? `UCSearch${i + 1}` : undefined
        },
        snippet: {
          publishedAt: '2024-01-01T12:00:00Z',
          channelId: channelId || 'UCTestChannel',
          title: `${q} - Result ${i + 1}`,
          description: `Search result ${i + 1} for query: ${q}`,
          thumbnails: mockVideoData.snippet.thumbnails,
          channelTitle: 'Test Channel',
          liveBroadcastContent: 'none',
          publishTime: '2024-01-01T12:00:00Z'
        }
      }));
      
      return Promise.resolve(createAPIResponse(searchResults, 'nextPageToken123'));
    })
  },
  
  // Error simulation utilities
  simulateError: (endpoint, errorCode = 403, errorMessage = 'quotaExceeded') => {
    const error = new Error(`YouTube API Error: ${errorMessage}`);
    error.code = errorCode;
    error.errors = [{ reason: errorMessage, domain: 'youtube.quota' }];
    
    // Override the specific endpoint method
    if (youTubeAPIMocks[endpoint] && youTubeAPIMocks[endpoint].list) {
      youTubeAPIMocks[endpoint].list.mockRejectedValueOnce(error);
    }
    
    return error;
  },
  
  // Reset all mocks
  resetMocks: () => {
    Object.values(youTubeAPIMocks).forEach(endpoint => {
      if (typeof endpoint === 'object' && endpoint !== null) {
        Object.values(endpoint).forEach(method => {
          if (typeof method === 'function' && method.mockClear) {
            method.mockClear();
          }
        });
      }
    });
  }
};

// Mock fetch responses for YouTube API calls
export const createYouTubeAPIFetchMock = (endpoint, response) => {
  return fetch.mockImplementation((url) => {
    if (url.includes(endpoint)) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(response)
      });
    }
    
    // Default mock response
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(createAPIResponse([]))
    });
  });
};