
const ACTIONS = {
  JOIN: 'join',
  JOINED: 'joined',
  DISCONNECTED: 'disconnected',
  CODE_CHANGE: 'code-change',
  SYNC_CODE: 'sync-code',
  LEAVE: 'leave',
  DEBUG_INFO: 'debug-info',
  PRESENCE_UPDATE: 'presence-update',
  SUBSCRIPTION_COUNT: 'subscription-count',
  
  // User presence specific events
  USER_CONNECTED: 'user-connected',
  USER_DISCONNECTED: 'user-disconnected',
  
  // Client-side events must use the 'client-' prefix for Pusher
  CLIENT_CODE_CHANGE: 'client-code-change',
  CLIENT_SYNC_REQUEST: 'client-sync-request',
  CLIENT_SYNC_RESPONSE: 'client-sync-response',
  CLIENT_PRESENCE_UPDATE: 'client-presence-update',
  
  // New events for better presence management
  CLIENT_JOIN_ROOM: 'client-join-room',
  CLIENT_LEAVE_ROOM: 'client-leave-room',
  CLIENT_USER_LIST: 'client-user-list'
};

export default ACTIONS;
