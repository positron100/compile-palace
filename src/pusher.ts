
import Pusher from "pusher-js";

// Generate a consistent user ID for the current browser session
const getUserId = () => {
  let userId = localStorage.getItem('userId');
  if (!userId) {
    userId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('userId', userId);
  }
  return userId;
};

// Get username from localStorage or use anonymous
const getUsername = () => {
  return localStorage.getItem('username') || 'Anonymous';
};

/**
 * Determines the type of Pusher channel based on its name
 * @param channelName The name of the channel
 * @returns 'public', 'private', or 'presence'
 */
export const getChannelType = (channelName: string): 'public' | 'private' | 'presence' => {
  if (channelName.startsWith('private-')) {
    return 'private';
  } else if (channelName.startsWith('presence-')) {
    return 'presence';
  } else {
    return 'public';
  }
};

// Store global list of all connected users by room
const connectedUsers: Record<string, any[]> = {};

// Global room state for sharing across tabs/sessions
if (typeof window !== 'undefined' && !(window as any).__roomState) {
  (window as any).__roomState = {
    rooms: {},
    users: {},
    lastSync: 0
  };
}

// Initialize Pusher with your app key and cluster
const pusher = new Pusher("8ff9dd9dd0d8fd5a50a7", {
  cluster: "ap2",
  forceTLS: true,
  enabledTransports: ['ws', 'wss']
  // No authorizer needed for public channels
});

// Enable debug logging in development mode
if (import.meta.env.DEV) {
  Pusher.logToConsole = true;
}

// Add event listeners for connection status
pusher.connection.bind('connecting', () => {
  console.log('Connecting to Pusher...');
});

pusher.connection.bind('connected', () => {
  console.log('Successfully connected to Pusher!');
  
  // Synchronize room state on connection
  syncGlobalRoomState();
});

pusher.connection.bind('unavailable', () => {
  console.log('Pusher connection unavailable');
});

pusher.connection.bind('failed', () => {
  console.error('Pusher connection failed');
});

pusher.connection.bind('disconnected', () => {
  console.log('Disconnected from Pusher');
  
  // Attempt reconnection after a short delay
  setTimeout(() => {
    console.log('Attempting to reconnect to Pusher...');
    pusher.connect();
  }, 3000);
});

pusher.connection.bind('error', (err) => {
  console.error('Pusher connection error:', err);
});

// Helper to track users by room
export const trackUserInRoom = (roomId: string, userData: any) => {
  if (!connectedUsers[roomId]) {
    connectedUsers[roomId] = [];
  }
  
  // Check if user already exists
  const existingUserIndex = connectedUsers[roomId].findIndex(
    user => user.username === userData.username
  );
  
  if (existingUserIndex >= 0) {
    // Update existing user data
    connectedUsers[roomId][existingUserIndex] = {
      ...connectedUsers[roomId][existingUserIndex],
      ...userData,
      lastSeen: Date.now()
    };
  } else {
    // Add new user
    connectedUsers[roomId].push({
      ...userData,
      lastSeen: Date.now()
    });
  }
  
  // Update global room state
  const globalState = (window as any).__roomState;
  if (!globalState.rooms[roomId]) {
    globalState.rooms[roomId] = {
      users: {},
      code: "",
      createdAt: Date.now()
    };
  }
  
  globalState.rooms[roomId].users[userData.username] = {
    ...userData,
    lastSeen: Date.now()
  };
  
  globalState.lastSync = Date.now();
  
  return connectedUsers[roomId];
};

// Helper to remove user from room
export const removeUserFromRoom = (roomId: string, username: string) => {
  if (connectedUsers[roomId]) {
    connectedUsers[roomId] = connectedUsers[roomId].filter(
      user => user.username !== username
    );
  }
  
  // Update global room state
  const globalState = (window as any).__roomState;
  if (globalState.rooms[roomId] && globalState.rooms[roomId].users[username]) {
    delete globalState.rooms[roomId].users[username];
    globalState.lastSync = Date.now();
  }
  
  return connectedUsers[roomId] || [];
};

// Get all users in a room
export const getUsersInRoom = (roomId: string) => {
  // Try to get from memory first
  const roomUsers = connectedUsers[roomId] || [];
  
  // If empty, try to get from global state
  if (roomUsers.length === 0) {
    const globalState = (window as any).__roomState;
    if (globalState.rooms[roomId]) {
      const globalUsers = Object.values(globalState.rooms[roomId].users);
      if (globalUsers.length > 0) {
        connectedUsers[roomId] = globalUsers as any[];
        return globalUsers as any[];
      }
    }
  }
  
  return roomUsers;
};

// Sync the room state from global window object
export const syncGlobalRoomState = () => {
  const globalState = (window as any).__roomState;
  
  // Copy all users from global state to local state
  Object.keys(globalState.rooms).forEach(roomId => {
    const roomData = globalState.rooms[roomId];
    const roomUsers = Object.values(roomData.users) as any[];
    
    if (roomUsers.length > 0) {
      connectedUsers[roomId] = roomUsers;
    }
  });
  
  console.log('Synchronized global room state:', globalState);
  return globalState;
};

// Update code for a specific room in global state
export const updateRoomCode = (roomId: string, code: string) => {
  const globalState = (window as any).__roomState;
  if (!globalState.rooms[roomId]) {
    globalState.rooms[roomId] = {
      users: {},
      code: "",
      createdAt: Date.now()
    };
  }
  
  globalState.rooms[roomId].code = code;
  globalState.lastSync = Date.now();
};

// Get code for a specific room from global state
export const getRoomCode = (roomId: string) => {
  const globalState = (window as any).__roomState;
  return globalState.rooms[roomId]?.code || "";
};

export default pusher;
