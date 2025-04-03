
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
  
  // For public channels we need to use regular events (no client- prefix)
  CODE_UPDATE: 'code-update',
  SYNC_REQUEST: 'sync-request',
  SYNC_RESPONSE: 'sync-response',
  PRESENCE_UPDATE_EVENT: 'presence-update-event',
  JOIN_ROOM: 'join-room',
  LEAVE_ROOM: 'leave-room',
  USER_LIST: 'user-list'
};

export default ACTIONS;
