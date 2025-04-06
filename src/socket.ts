
import { io, Socket } from 'socket.io-client';

// Use the production server URL
const SERVER_URL = 'https://code-editor-f145.onrender.com';

// Store code for each room (for local reference)
const roomCodeStore: Record<string, string> = {};
const roomUsersCount: Record<string, number> = {};

// Global socket instance
let socket: Socket | null = null;

/**
 * Initialize socket connection
 */
export const initSocket = (): Socket => {
  if (!socket) {
    socket = io(SERVER_URL, {
      transports: ['websocket'],
      timeout: 10000,
    });
    
    socket.on('connect', () => {
      // Socket connected
    });
    
    socket.on('connect_error', (err) => {
      // Connection error
    });
    
    socket.on('disconnect', () => {
      // Disconnected
    });
  }
  
  return socket;
};

// Store room code and track users
export const updateRoomCode = (roomId: string, code: string) => {
  if (roomId) {
    roomCodeStore[roomId] = code;
  }
};

// Get stored room code
export const getRoomCode = (roomId: string): string => {
  return roomCodeStore[roomId] || '';
};

// Track users in a room
export const updateRoomUsers = (roomId: string, count: number) => {
  if (roomId) {
    roomUsersCount[roomId] = count;
    
    // If room is empty (0 users), clear the stored code
    if (count <= 0) {
      delete roomCodeStore[roomId];
    }
  }
};

// Get user count for a room
export const getRoomUserCount = (roomId: string): number => {
  return roomUsersCount[roomId] || 0;
};

// Get current socket instance
export const getSocket = (): Socket | null => socket;

// Disconnect socket
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
