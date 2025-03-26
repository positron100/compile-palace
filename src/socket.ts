
import { io, Socket } from 'socket.io-client';

// For production, use a deployed backend URL
// For development, use local server or mock
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

let socket: Socket | null = null;

export const initSocket = async (): Promise<Socket> => {
  if (!socket) {
    try {
      socket = io(SERVER_URL, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
      });
      
      // If in dev with no server, use mock socket behavior
      if (import.meta.env.DEV && !import.meta.env.VITE_SERVER_URL) {
        mockSocketBehavior(socket);
      }
      
      await new Promise<void>((resolve, reject) => {
        socket?.on('connect', () => {
          console.log('Socket connected');
          resolve();
        });
        
        socket?.on('connect_error', (err) => {
          console.error('Socket connection error:', err);
          // Only reject if we haven't already connected
          if (socket?.connected !== true) {
            reject(err);
          }
        });
        
        // Set a timeout for the connection
        const timeout = setTimeout(() => {
          if (socket?.connected !== true) {
            reject(new Error('Socket connection timeout'));
          }
        }, 5000);
        
        // Clear the timeout if we connect successfully
        socket?.on('connect', () => clearTimeout(timeout));
      });
    } catch (err) {
      console.error('Socket initialization error:', err);
      
      // If we're in development, fallback to mock socket
      if (import.meta.env.DEV) {
        socket = mockSocket();
      } else {
        throw err;
      }
    }
  }
  
  return socket;
};

// Mock socket implementation for development when server is not available
function mockSocket(): Socket {
  // @ts-ignore - Creating a minimal mock implementation
  const mockSocket: Socket = {
    connected: true,
    id: `mock-${Math.random().toString(36).substring(2, 9)}`,
    on: (event: string, callback: Function) => {
      console.log(`Mock socket registered event: ${event}`);
      return mockSocket;
    },
    off: (event: string) => {
      console.log(`Mock socket unregistered event: ${event}`);
      return mockSocket;
    },
    emit: (event: string, ...args: any[]) => {
      console.log(`Mock socket emitted event: ${event}`, args);
      return mockSocket;
    },
    disconnect: () => {
      console.log('Mock socket disconnected');
    }
  };
  
  mockSocketBehavior(mockSocket);
  return mockSocket;
}

// Add mock behavior to simulate a real socket
function mockSocketBehavior(socket: any): void {
  const ACTIONS = {
    JOIN: 'join',
    JOINED: 'joined',
    DISCONNECTED: 'disconnected',
    CODE_CHANGE: 'code-change',
    SYNC_CODE: 'sync-code',
    LEAVE: 'leave',
  };
  
  // Create mock clients list
  const mockClients = [
    { socketId: 'mock-1', username: 'User1' },
    { socketId: 'mock-2', username: 'User2' }
  ];
  
  // Simulate JOIN response
  socket.on(ACTIONS.JOIN, ({ roomId, username }: { roomId: string, username: string }) => {
    console.log(`Mock user ${username} joined room ${roomId}`);
    
    // Add the new user to mock clients
    const newClient = { socketId: socket.id, username };
    
    // Simulate server response
    setTimeout(() => {
      // Fix: Changed from socket.on to socket.emit to properly emit the event
      socket.emit(ACTIONS.JOINED, {
        clients: [...mockClients, newClient],
        username,
        socketId: socket.id
      });
    }, 500);
  });
  
  // Simulate code sync
  socket.on(ACTIONS.CODE_CHANGE, ({ code }: { code: string }) => {
    console.log('Mock code change received:', code);
    // Echo back to all clients
    setTimeout(() => {
      // Fix: Changed from socket.on to socket.emit to properly emit the event
      socket.emit(ACTIONS.CODE_CHANGE, { code });
    }, 100);
  });
}
