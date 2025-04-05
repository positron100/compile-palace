
import { io, Socket } from 'socket.io-client';

// Use the production server URL
const SERVER_URL = 'https://code-editor-f145.onrender.com';

// Store code for each room (for local reference)
const roomCodeStore: Record<string, string> = {};

// Global socket instance
let socket: Socket | null = null;

/**
 * Initialize socket connection
 */
export const initSocket = (): Socket => {
  if (!socket) {
    console.log('Connecting to socket server at', SERVER_URL);
    
    socket = io(SERVER_URL, {
      transports: ['websocket'],
      timeout: 10000,
    });
    
    socket.on('connect', () => {
      console.log('Successfully connected to socket server!');
    });
    
    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
    });
    
    socket.on('disconnect', () => {
      console.log('Disconnected from socket server');
    });
  }
  
  return socket;
};

// Store room code
export const updateRoomCode = (roomId: string, code: string) => {
  if (roomId) {
    roomCodeStore[roomId] = code;
  }
};

// Get stored room code
export const getRoomCode = (roomId: string): string => {
  return roomCodeStore[roomId] || '';
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
