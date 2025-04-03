
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
  
  // For public channels we need to use standard events (no client- prefix)
  CODE_UPDATE: 'code-update',
  SYNC_REQUEST: 'sync-request',
  SYNC_RESPONSE: 'sync-response',
  PRESENCE_UPDATE_EVENT: 'presence-update-event',
  JOIN_ROOM: 'join-room',
  LEAVE_ROOM: 'leave-room',
  USER_LIST: 'user-list',
  
  // Fixed consistent naming for events
  ROOM_USERS: 'room-users',
  CODE_BROADCAST: 'code-broadcast',
  
  // Additional events for global state synchronization
  GLOBAL_SYNC_REQUEST: 'global-sync-request',
  GLOBAL_SYNC_RESPONSE: 'global-sync-response',
  GLOBAL_USER_LIST: 'global-user-list',
  GLOBAL_ROOM_USERS: 'global-room-users'
};

export default ACTIONS;
