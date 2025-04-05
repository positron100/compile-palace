
import ACTIONS from '../Actions';
import { initSocket, updateRoomCode, getRoomCode } from '../socket';

// Store users per room for local reference
const roomUsers: Record<string, any[]> = {};
const lastPresenceUpdate: Record<string, number> = {};
const presenceThrottleTime = 1000;

// Connect to room and announce presence
export const connectToRoom = async (roomId: string, username: string) => {
  if (!roomId || !username) {
    console.error("Cannot connect without room ID and username");
    return null;
  }
  
  console.log(`User ${username} connecting to room ${roomId}`);
  
  // Initialize socket connection
  const socket = initSocket();
  
  // Join the room via socket
  socket.emit(ACTIONS.JOIN, {
    roomId,
    username
  });
  
  // Store local user data
  const userData = { username, roomId, lastSeen: Date.now() };
  localStorage.setItem('userData', JSON.stringify(userData));
  
  return socket;
};

// Disconnect user from room
export const disconnectFromRoom = (roomId: string, username: string, socket: any) => {
  if (!roomId || !username || !socket) return;
  
  console.log(`User ${username} disconnecting from room ${roomId}`);
  
  // Announce leaving via socket
  socket.emit(ACTIONS.LEAVE, { roomId });
  
  // Remove from local storage
  if (roomUsers[roomId]) {
    roomUsers[roomId] = roomUsers[roomId].filter(user => user.username !== username);
  }
  
  // Disconnect socket
  socket.disconnect();
};

// Get current list of users in a room
export const getRoomUsers = (roomId: string) => {
  return roomUsers[roomId] || [];
};

// Update the room users list
export const updateRoomUsers = (roomId: string, users: any[]) => {
  if (roomId) {
    roomUsers[roomId] = users;
  }
  return roomUsers[roomId] || [];
};

// Track user presence
export const trackUserPresence = (roomId: string, username: string) => {
  const throttleKey = `${roomId}-${username}`;
  const now = Date.now();
  
  // Skip if updated too recently
  if (lastPresenceUpdate[throttleKey] && now - lastPresenceUpdate[throttleKey] < presenceThrottleTime) {
    return;
  }
  
  lastPresenceUpdate[throttleKey] = now;
  
  // Add user to local room users
  if (!roomUsers[roomId]) {
    roomUsers[roomId] = [];
  }
  
  const existingUserIndex = roomUsers[roomId].findIndex(user => user.username === username);
  
  if (existingUserIndex >= 0) {
    roomUsers[roomId][existingUserIndex].lastSeen = now;
  } else {
    roomUsers[roomId].push({
      username,
      socketId: `local-${Date.now()}`,
      lastSeen: now
    });
  }
  
  return roomUsers[roomId];
};

export default {
  connectToRoom,
  disconnectFromRoom,
  getRoomUsers,
  updateRoomUsers,
  trackUserPresence
};
