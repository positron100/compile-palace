
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
  // Create a minimal mock implementation
  const mockSocket = {
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
      
      // For JOIN events, immediately trigger the JOINED response
      if (event === 'join' && args[0]?.roomId && args[0]?.username) {
        setTimeout(() => {
          mockSocketBehavior(mockSocket as Socket);
          if (mockSocket._callbacks && mockSocket._callbacks['joined']) {
            mockSocket._callbacks['joined']({
              clients: mockClients,
              username: args[0].username,
              socketId: mockSocket.id
            });
          }
        }, 100);
      }
      
      return mockSocket;
    },
    disconnect: () => {
      console.log('Mock socket disconnected');
    },
    
    // For mock callbacks storage
    _callbacks: {} as Record<string, Function>
  } as any as Socket;
  
  mockSocketBehavior(mockSocket);
  return mockSocket;
}

// Mock clients for development
const mockClients = [
  { socketId: 'mock-1', username: 'User1' },
  { socketId: 'mock-2', username: 'User2' },
  { socketId: 'mock-3', username: 'User3' }
];

// Add mock behavior to simulate a real socket
function mockSocketBehavior(socket: Socket): void {
  const ACTIONS = {
    JOIN: 'join',
    JOINED: 'joined',
    DISCONNECTED: 'disconnected',
    CODE_CHANGE: 'code-change',
    SYNC_CODE: 'sync-code',
    LEAVE: 'leave',
  };
  
  // Override the 'on' method to store callbacks
  const originalOn = socket.on;
  (socket as any)._callbacks = (socket as any)._callbacks || {};
  
  socket.on = function(event: string, callback: Function) {
    console.log(`Mock socket registered event: ${event}`);
    (socket as any)._callbacks[event] = callback;
    return originalOn.call(this, event, callback);
  };
  
  // Simulate JOIN response
  socket.on(ACTIONS.JOIN, ({ roomId, username }: { roomId: string, username: string }) => {
    console.log(`Mock user ${username} joined room ${roomId}`);
    
    // Add the new user to mock clients if not already there
    if (!mockClients.some(client => client.socketId === socket.id)) {
      const newClient = { socketId: socket.id, username };
      mockClients.push(newClient);
    }
    
    // Simulate server response
    setTimeout(() => {
      if ((socket as any)._callbacks && (socket as any)._callbacks[ACTIONS.JOINED]) {
        (socket as any)._callbacks[ACTIONS.JOINED]({
          clients: mockClients,
          username,
          socketId: socket.id
        });
      }
    }, 500);
  });
  
  // Simulate code sync
  socket.on(ACTIONS.CODE_CHANGE, ({ code }: { code: string }) => {
    console.log('Mock code change received:', code);
    // Echo back to all clients
    setTimeout(() => {
      if ((socket as any)._callbacks && (socket as any)._callbacks[ACTIONS.CODE_CHANGE]) {
        (socket as any)._callbacks[ACTIONS.CODE_CHANGE]({ code });
      }
    }, 100);
  });
}
