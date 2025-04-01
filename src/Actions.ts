
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
  // Client-side events must use the client- prefix for Pusher
  CLIENT_CODE_CHANGE: 'client-code-change',
  CLIENT_SYNC_REQUEST: 'client-sync-request',
  CLIENT_SYNC_RESPONSE: 'client-sync-response'
};

export default ACTIONS;
