// API Endpoints Configuration
export const API_ENDPOINTS = {
  // Auth endpoints
  AUTH: {
    LOGIN: '/api/v1/auth/login',
    REGISTER: '/api/v1/auth/register',
    GOOGLE: '/api/v1/auth/google',
    LOGOUT: '/api/v1/auth/logout',
  },

  // User endpoints
  USERS: {
    ME: '/api/v1/users/me',
    PROFILE: '/api/v1/users/:id',
    EVENTS: '/api/v1/users/me/events',
    SAVED_EVENTS: '/api/v1/users/me/saved-events',
    FOLLOWED_CLUBS: '/api/v1/users/me/followed-clubs',
  },

  // Event endpoints
  EVENTS: {
    LIST: '/api/v1/events',
    DETAIL: '/api/v1/events/:id',
    CREATE: '/api/v1/events',
    UPDATE: '/api/v1/events/:id',
    DELETE: '/api/v1/events/:id',
    REGISTER: '/api/v1/events/:id/register',
    UNREGISTER: '/api/v1/events/:id/unregister',
    SEARCH: '/api/v1/events/search',
  },

  // Club endpoints
  CLUBS: {
    LIST: '/api/v1/clubs',
    DETAIL: '/api/v1/clubs/:id',
    CREATE: '/api/v1/clubs',
    UPDATE: '/api/v1/clubs/:id',
    DELETE: '/api/v1/clubs/:id',
    FOLLOW: '/api/v1/clubs/:id/follow',
    UNFOLLOW: '/api/v1/clubs/:id/unfollow',
    EVENTS: '/api/v1/clubs/:id/events',
  },
} as const;
