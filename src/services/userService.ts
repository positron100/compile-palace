
import ACTIONS from '../Actions';
import pusher, { trackUserInRoom, getUsersInRoom, removeUserFromRoom } from '../pusher';
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
    }, 500);
  }
  
  // Track user in global state
  trackUserInRoom(roomId, {
    username,
    socketId: socket?.id || `user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    lastSeen: Date.now()
  });
  
  return socket;
};

// Disconnect user from room and announce departure
export const disconnectFromRoom = (roomId: string, username: string, socket: any) => {
  if (!roomId || !username) return;
  
  console.log(`User ${username} disconnecting from room ${roomId}`);
  
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
};

// Get current list of users in a room
export const getRoomUsers = (roomId: string) => {
  if (!roomId) return [];
  return getUsersInRoom(roomId);
};

// Sync current user data across tabs and sessions
export const syncUserPresence = (roomId: string, username: string) => {
  if (!roomId || !username) return;
  
  trackUserInRoom(roomId, {
    username,
    socketId: `user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    lastSeen: Date.now()
  });
};

export default {
  connectToRoom,
  disconnectFromRoom,
  getRoomUsers,
  syncUserPresence,
  getLocalUserData,
  setLocalUserData
};
