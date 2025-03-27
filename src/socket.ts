
import { io, Socket } from 'socket.io-client';

// Extended socket interface to include our custom _callbacks property
interface ExtendedSocket extends Socket {
  _callbacks?: Record<string, Function>;
}

// For production, use a deployed backend URL
// For development, use local server or mock
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

let socket: Socket | null = null;
let socketInitPromise: Promise<Socket> | null = null;
let useMockSocket = false;

// Generate a consistent client ID for this session
const getClientId = (): string => {
  // Check if we already have an ID stored in sessionStorage
  let clientId = sessionStorage.getItem('clientId');
  
  // If not, create a new one and store it
  if (!clientId) {
    clientId = `client-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`;
    sessionStorage.setItem('clientId', clientId);
  }
  
  return clientId;
};

export const initSocket = async (): Promise<Socket> => {
  // Always force a new socket connection on initialization
  if (socket) {
    console.log('Disconnecting existing socket connection');
    socket.disconnect();
    socket = null;
  }
  
  // Reset the initialization promise
  socketInitPromise = null;
  
  // Create a new promise for socket initialization
  socketInitPromise = new Promise<Socket>(async (resolve, reject) => {
    try {
      // If previous attempt failed and we're in dev, use mock right away
      if (useMockSocket && import.meta.env.DEV) {
        console.log('Using mock socket implementation');
        socket = mockSocket();
        resolve(socket);
        return;
      }
      
      // Get the client ID for this session
      const clientId = getClientId();
      
      // Try to connect to a real socket server
      console.log(`Attempting to connect to socket server at ${SERVER_URL} with client ID ${clientId}`);
      socket = io(SERVER_URL, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
        forceNew: true, // Force new connection to avoid issues with multiple tabs
        query: { clientId } // Pass the client ID to identify this connection
      });
      
      // Set up connection/error handlers
      const connectionPromise = new Promise<void>((resolveConn, rejectConn) => {
        // Handle successful connection
        socket?.on('connect', () => {
          console.log('Socket connected successfully with ID:', socket?.id);
          useMockSocket = false;
          resolveConn();
        });
        
        // Handle connection error
        socket?.on('connect_error', (err) => {
          console.error('Socket connection error:', err);
          // Only reject if we haven't already connected
          if (socket?.connected !== true) {
            rejectConn(err);
          }
        });
        
        // Set a timeout for the connection
        const timeout = setTimeout(() => {
          if (socket?.connected !== true) {
            rejectConn(new Error('Socket connection timeout'));
          }
        }, 3000); // Reduced timeout for faster feedback
        
        // Clear the timeout if we connect successfully
        socket?.on('connect', () => clearTimeout(timeout));
      });
      
      // Wait for connection to be established
      await connectionPromise;
      resolve(socket);
      
    } catch (err) {
      console.error('Socket initialization error, falling back to mock:', err);
      
      // If we're in development, fallback to mock socket
      if (import.meta.env.DEV) {
        useMockSocket = true;
        socket = mockSocket();
        resolve(socket);
      } else {
        reject(err);
      }
    }
  });
  
  return socketInitPromise;
};

// Mock socket implementation for development when server is not available
function mockSocket(): Socket {
  console.log('Creating mock socket');
  // Create a minimal mock implementation with our custom _callbacks property
  const mockSocket: ExtendedSocket = {
    connected: true,
    id: `mock-${Math.random().toString(36).substring(2, 9)}`,
    on: (event: string, callback: Function) => {
      console.log(`Mock socket registered event: ${event}`);
      mockSocket._callbacks = mockSocket._callbacks || {};
      mockSocket._callbacks[event] = callback;
      return mockSocket;
    },
    off: (event: string) => {
      console.log(`Mock socket unregistered event: ${event}`);
      return mockSocket;
    },
    emit: (event: string, ...args: any[]) => {
      console.log(`Mock socket emitted event: ${event}`, args);
      
      // For JOIN events, immediately trigger the JOINED response with only the current user
      if (event === 'join' && args[0]?.roomId && args[0]?.username) {
        setTimeout(() => {
          if (mockSocket._callbacks && mockSocket._callbacks['joined']) {
            mockSocket._callbacks['joined']({
              clients: [{ socketId: mockSocket.id, username: args[0].username }],
              username: args[0].username,
              socketId: mockSocket.id
            });
          }
        }, 100);
      }
      
      // For CODE_CHANGE events, echo back to all clients
      if (event === 'code-change' && args[0]?.code !== undefined) {
        setTimeout(() => {
          if (mockSocket._callbacks && mockSocket._callbacks['code-change']) {
            mockSocket._callbacks['code-change']({ code: args[0].code });
          }
        }, 100);
      }
      
      return mockSocket;
    },
    disconnect: () => {
      console.log('Mock socket disconnected');
    },
    // Add stub implementations for all required Socket methods
    io: null as any,
    nsp: '',
    active: true,
    volatile: {} as any,
    timeout: () => ({} as any),
    connect: () => mockSocket,
    send: () => mockSocket,
    compress: () => mockSocket,
    open: () => mockSocket,
    close: () => {},
    replaceTransport: () => {},
    onopen: () => {},
    onclose: () => {},
    onpacket: () => {},
    onevent: () => {},
    acks: {},
    flags: {},
    subs: [],
    pid: 0,
    auth: {},
    receiveBuffer: [],
    sendBuffer: [],
    ids: 0,
    ioFailed: false,
    managers: {},
    nsps: {},
    backoff: {} as any,
    _callbacks: {}
  } as any as Socket; // Type assertion here is needed because our mock doesn't implement all Socket methods
  
  // Initialize mock behavior
  mockSocketBehavior(mockSocket);
  return mockSocket;
}

// Function to get mock clients - only include the current user
function getMockClients(currentUsername: string): {socketId: string, username: string}[] {
  // Only include the current user - no default users
  return [{ socketId: `mock-${Math.random().toString(36).substring(2, 9)}`, username: currentUsername }];
}

// Add mock behavior to simulate a real socket
function mockSocketBehavior(socket: Socket): void {
  const extendedSocket = socket as ExtendedSocket;
  const ACTIONS = {
    JOIN: 'join',
    JOINED: 'joined',
    DISCONNECTED: 'disconnected',
    CODE_CHANGE: 'code-change',
    SYNC_CODE: 'sync-code',
    LEAVE: 'leave',
  };
  
  console.log('Setting up mock socket behavior');
  
  // Initialize _callbacks object if it doesn't exist
  extendedSocket._callbacks = extendedSocket._callbacks || {};
  
  // Override the 'on' method to store callbacks
  const originalOn = socket.on;
  socket.on = function(event: string, callback: Function) {
    console.log(`Mock socket registered event: ${event}`);
    extendedSocket._callbacks = extendedSocket._callbacks || {};
    extendedSocket._callbacks[event] = callback;
    return originalOn.call(this, event, callback);
  };
  
  // Simulate SYNC_CODE event
  socket.on(ACTIONS.SYNC_CODE, ({ code, socketId }: { code: string, socketId: string }) => {
    console.log(`Mock socket syncing code for ${socketId}`);
    // If another socket needs to receive the code
    if (extendedSocket._callbacks && extendedSocket._callbacks[ACTIONS.CODE_CHANGE]) {
      extendedSocket._callbacks[ACTIONS.CODE_CHANGE]({ code });
    }
  });
}
