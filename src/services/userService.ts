
import ACTIONS from '../Actions';
import pusher, { trackUserInRoom, getUsersInRoom, removeUserFromRoom, getPusherChannel } from '../pusher';
import { initSocket } from '../socket';

// Get user data from localStorage
const getLocalUserData = () => {
  try {
    const userData = localStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
  } catch (err) {
    console.error("Error retrieving user data from localStorage", err);
    return null;
  }
};

// Store client data in localStorage to persist across tabs
const setLocalUserData = (username: string, roomId: string) => {
  try {
    const userData = {
      username,
      roomId,
      lastSeen: Date.now()
    };
    localStorage.setItem('userData', JSON.stringify(userData));
    
    // Also update global state
    trackUserInRoom(roomId, {
      username,
      socketId: `user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      lastSeen: Date.now()
    });
  } catch (err) {
    console.error("Error storing user data in localStorage", err);
  }
};

// Connect socket and announce user presence
export const connectToRoom = async (roomId: string, username: string) => {
  if (!roomId || !username) {
    console.error("Cannot connect without room ID and username");
    return null;
  }
  
  console.log(`User ${username} connecting to room ${roomId}`);
  
  // Store user data in localStorage
  setLocalUserData(username, roomId);
  
  // Initialize socket connection
  const socket = await initSocket();
  
  // Announce presence via socket and Pusher
  if (socket) {
    // Join the room via socket
    socket.emit(ACTIONS.JOIN, {
      roomId,
      username
    });
    
    // Announce joining the room
    socket.emit(ACTIONS.JOIN_ROOM, {
      roomId,
      username,
      timestamp: Date.now()
    });
    
    // Update presence information
    socket.emit(ACTIONS.PRESENCE_UPDATE_EVENT, {
      roomId,
      username,
      timestamp: Date.now(),
      action: 'connected'
    });
    
    // Request initial sync from other users
    setTimeout(() => {
      socket.emit(ACTIONS.SYNC_REQUEST, { 
        roomId,
        requestor: username 
      });
      
      // Global sync request for cross-tab compatibility
      socket.emit(ACTIONS.GLOBAL_SYNC_REQUEST, { 
        roomId,
        requestor: username 
      });
      
      // Force update user list
      broadcastRoomUsers(roomId);
    }, 500);
  }
  
  // Track user in global state
  trackUserInRoom(roomId, {
    username,
    socketId: socket?.id || `user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    lastSeen: Date.now()
  });
  
  // Try to announce presence via Pusher channel
  try {
    const channelName = `collab-${roomId}`;
    const channel = getPusherChannel(channelName) || pusher.subscribe(channelName);
    
    if (channel) {
      // For public channels, use trigger instead of client events
      channel.trigger(ACTIONS.PRESENCE_UPDATE_EVENT, {
        username,
        timestamp: Date.now(),
        action: 'connected'
      });
      
      channel.trigger(ACTIONS.JOIN_ROOM, {
        username,
        timestamp: Date.now()
      });
      
      // Also broadcast current user list
      channel.trigger(ACTIONS.ROOM_USERS, {
        users: getUsersInRoom(roomId),
        count: getUsersInRoom(roomId).length
      });
    }
  } catch (err) {
    console.error("Error announcing presence via Pusher", err);
  }
  
  return socket;
};

// Broadcast current room users to all clients
export const broadcastRoomUsers = (roomId: string) => {
  if (!roomId) return;
  
  const users = getUsersInRoom(roomId);
  console.log(`Broadcasting room users for ${roomId}:`, users);
  
  // Try via Pusher channel
  try {
    const channelName = `collab-${roomId}`;
    const channel = getPusherChannel(channelName);
    
    if (channel) {
      // For public channels, use trigger
      channel.trigger(ACTIONS.ROOM_USERS, {
        users,
        count: users.length
      });
      
      channel.trigger(ACTIONS.PRESENCE_UPDATE, {
        clients: users,
        count: users.length
      });
    }
  } catch (err) {
    console.error("Error broadcasting room users via Pusher", err);
  }
};

// Disconnect user from room and announce departure
export const disconnectFromRoom = (roomId: string, username: string, socket: any) => {
  if (!roomId || !username) return;
  
  console.log(`User ${username} disconnecting from room ${roomId}`);
  
  // Try to announce departure via Pusher channel first
  try {
    const channelName = `collab-${roomId}`;
    const channel = getPusherChannel(channelName);
    
    if (channel) {
      // For public channels, use trigger
      channel.trigger(ACTIONS.PRESENCE_UPDATE_EVENT, {
        username,
        timestamp: Date.now(),
        action: 'disconnected'
      });
      
      channel.trigger(ACTIONS.LEAVE_ROOM, {
        username,
        timestamp: Date.now()
      });
    }
  } catch (err) {
    console.error("Error announcing departure via Pusher", err);
  }
  
  // Remove from global state
  removeUserFromRoom(roomId, username);
  
  // Announce disconnection via socket
  if (socket) {
    socket.emit(ACTIONS.PRESENCE_UPDATE_EVENT, {
      roomId,
      username,
      timestamp: Date.now(),
      action: 'disconnected'
    });
    
    socket.emit(ACTIONS.LEAVE_ROOM, {
      roomId,
      username,
      timestamp: Date.now()
    });
    
    socket.emit(ACTIONS.LEAVE, { roomId });
    
    // Disconnect socket
    socket.disconnect();
  }
  
  // Broadcast updated user list
  setTimeout(() => {
    broadcastRoomUsers(roomId);
  }, 300);
};

// Get current list of users in a room
export const getRoomUsers = (roomId: string) => {
  if (!roomId) return [];
  return getUsersInRoom(roomId);
};

// Sync current user data across tabs and sessions
export const syncUserPresence = (roomId: string, username: string) => {
  if (!roomId || !username) return;
  
  const userData = {
    username,
    socketId: `user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    lastSeen: Date.now()
  };
  
  trackUserInRoom(roomId, userData);
  
  // Also try to broadcast via Pusher
  try {
    const channelName = `collab-${roomId}`;
    const channel = getPusherChannel(channelName);
    
    if (channel) {
      // For public channels, use trigger
      channel.trigger(ACTIONS.PRESENCE_UPDATE_EVENT, {
        username,
        timestamp: Date.now(),
        action: 'connected'
      });
      
      // Also broadcast current user list
      broadcastRoomUsers(roomId);
    }
  } catch (err) {
    console.error("Error syncing user presence via Pusher", err);
  }
  
  return userData;
};

export default {
  connectToRoom,
  disconnectFromRoom,
  getRoomUsers,
  syncUserPresence,
  getLocalUserData,
  setLocalUserData,
  broadcastRoomUsers
};
