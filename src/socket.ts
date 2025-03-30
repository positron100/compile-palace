
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import ACTIONS from './Actions';

// For production, use a deployed backend URL
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

// Global socket instance
let socket: Socket | null = null;

// Global mock data to replicate server behavior
if (typeof window !== 'undefined') {
  if (!(window as any).__mockData) {
    (window as any).__mockData = {
      rooms: {},
      userSocketMap: {}
    };
  }
}

// Client ID management
const getClientId = (): string => {
  let clientId = sessionStorage.getItem('clientId');
  if (!clientId) {
    clientId = `client-${Date.now()}-${uuidv4()}`;
    sessionStorage.setItem('clientId', clientId);
  }
  return clientId;
};

// Get all connected clients in a room (for mock mode)
const getAllConnectedClients = (roomId: string) => {
  const mockData = (window as any).__mockData;
  if (!mockData.rooms[roomId]) return [];
  
  return Array.from(mockData.rooms[roomId] || []).map((socketId: string) => {
    return {
      socketId,
      username: mockData.userSocketMap[socketId],
    };
  });
};

// Define the ExtendedSocket interface with our mock-specific properties
interface ExtendedSocket extends Socket {
  mockRooms?: Set<string>;
}

// Enhanced mock socket to closely mirror the original server implementation
const createMockSocket = (): Socket => {
  console.log('Creating mock socket for offline mode');
  
  const mockData = (window as any).__mockData;
  const mockSocketId = `mock-${uuidv4()}`;
  const mockRooms = new Set<string>();
  
  // Create event system to simulate socket behavior
  const events: Record<string, Function[]> = {};
  
  function on(event: string, callback: Function) {
    console.log(`Mock socket: Registered listener for "${event}"`);
    if (!events[event]) events[event] = [];
    events[event].push(callback);
    return this;
  }
  
  function off(event: string, callback?: Function) {
    console.log(`Mock socket: Removed listener for "${event}"`);
    if (!events[event]) return this;
    
    if (callback) {
      events[event] = events[event].filter(cb => cb !== callback);
    } else {
      delete events[event];
    }
    return this;
  }
  
  function emit(event: string, ...args: any[]) {
    console.log(`Mock socket: Emitted "${event}"`, args);
    
    // Handle JOIN event - mirror server implementation
    if (event === ACTIONS.JOIN && args[0]?.roomId && args[0]?.username) {
      const { roomId, username } = args[0];
      
      // Add user to socket map (like userSocketMap on server)
      mockData.userSocketMap[mockSocketId] = username;
      
      // Add socket to room
      if (!mockData.rooms[roomId]) {
        mockData.rooms[roomId] = new Set();
      }
      mockData.rooms[roomId].add(mockSocketId);
      mockRooms.add(roomId);
      
      // Get all clients in room
      const clients = getAllConnectedClients(roomId);
      
      // Broadcast JOINED event to all clients in room (including self)
      setTimeout(() => {
        if (mockData.rooms[roomId]) {
          Array.from(mockData.rooms[roomId]).forEach((socketId: string) => {
            const joinedCallbacks = events[ACTIONS.JOINED] || [];
            joinedCallbacks.forEach(cb => cb({
              clients,
              username,
              socketId: mockSocketId
            }));
          });
        }
      }, 100);
    }
    
    // Handle CODE_CHANGE event
    if (event === ACTIONS.CODE_CHANGE && args[0]?.roomId && args[0]?.code) {
      const { roomId, code } = args[0];
      
      // Broadcast to all other clients in room
      setTimeout(() => {
        if (mockData.rooms[roomId]) {
          Array.from(mockData.rooms[roomId]).forEach((socketId: string) => {
            if (socketId !== mockSocketId) { // Don't send back to self
              const codeChangeCallbacks = events[ACTIONS.CODE_CHANGE] || [];
              codeChangeCallbacks.forEach(cb => cb({ code }));
            }
          });
        }
      }, 50);
    }
    
    // Handle SYNC_CODE event
    if (event === ACTIONS.SYNC_CODE && args[0]?.socketId && args[0]?.code) {
      const { socketId, code } = args[0];
      
      // Send code only to the specific client
      setTimeout(() => {
        const codeChangeCallbacks = events[ACTIONS.CODE_CHANGE] || [];
        codeChangeCallbacks.forEach(cb => cb({ code }));
      }, 50);
    }
    
    // Handle SYNC_CODE event with just roomId
    if (event === ACTIONS.SYNC_CODE && args[0]?.roomId) {
      console.log("Mock socket: SYNC_CODE request received for room", args[0].roomId);
      // In a real server, this would fetch the code for the room and send it back
      // For mock, we'll just simulate an empty response
      setTimeout(() => {
        const codeChangeCallbacks = events[ACTIONS.SYNC_CODE] || [];
        codeChangeCallbacks.forEach(cb => cb({ code: "" }));
      }, 50);
    }
    
    // Handle disconnection
    if (event === 'disconnecting') {
      // Broadcast DISCONNECTED to all rooms this socket is in
      setTimeout(() => {
        mockRooms.forEach((roomId) => {
          if (mockData.rooms[roomId]) {
            Array.from(mockData.rooms[roomId]).forEach((socketId: string) => {
              if (socketId !== mockSocketId) {
                const disconnectedCallbacks = events[ACTIONS.DISCONNECTED] || [];
                disconnectedCallbacks.forEach(cb => cb({
                  socketId: mockSocketId,
                  username: mockData.userSocketMap[mockSocketId]
                }));
              }
            });
            
            // Remove this socket from the room
            mockData.rooms[roomId].delete(mockSocketId);
            
            // Clean up empty rooms
            if (mockData.rooms[roomId].size === 0) {
              delete mockData.rooms[roomId];
            }
          }
        });
        
        // Remove from user socket map
        delete mockData.userSocketMap[mockSocketId];
        mockRooms.clear();
      }, 50);
    }
    
    return this;
  }
  
  function join(roomId: string) {
    mockRooms.add(roomId);
    if (!mockData.rooms[roomId]) {
      mockData.rooms[roomId] = new Set();
    }
    mockData.rooms[roomId].add(mockSocketId);
    return this;
  }
  
  function inRoom(roomId: string) {
    return {
      emit: (event: string, data: any) => {
        if (mockData.rooms[roomId]) {
          Array.from(mockData.rooms[roomId]).forEach((socketId: string) => {
            if (socketId !== mockSocketId) { // Don't send to self
              const callbacks = events[event] || [];
              callbacks.forEach(cb => cb(data));
            }
          });
        }
      }
    };
  }
  
  function toSocket(socketId: string) {
    return {
      emit: (event: string, data: any) => {
        const callbacks = events[event] || [];
        callbacks.forEach(cb => cb(data));
      }
    };
  }
  
  function disconnect() {
    console.log('Mock socket: Disconnected');
    
    // Run disconnecting event handlers
    this.emit('disconnecting');
    
    // Clear all event listeners
    Object.keys(events).forEach(event => delete events[event]);
  }
  
  // Create a base mock socket object
  const mockSocketBase = {
    id: mockSocketId,
    connected: true,
    mockRooms,
    
    on,
    off,
    emit,
    join,
    in: inRoom,
    to: toSocket,
    disconnect,
    
    // Add minimal implementations of remaining Socket interface methods
    connect: function() { return this; },
    io: { engine: { id: mockSocketId } },
    nsp: '/',
    volatile: { emit: function() { return this; } },
    timeout: function() { return { emit: function() { return Promise.resolve(); } }; },
    send: function() { return this; },
    binary: function() { return this; },
    compress: function() { return this; },
    emitWithAck: function() { return Promise.resolve(); },
    listeners: function() { return []; },
    hasListeners: function() { return false; },
    onAny: function() { return this; },
    prependAny: function() { return this; },
    offAny: function() { return this; },
    listenersAny: function() { return []; },
    eventNames: function() { return []; },
    decorate: function() { return this; }
  };
  
  // Bind all functions to the mockSocketBase object
  Object.keys(mockSocketBase).forEach(key => {
    if (typeof (mockSocketBase as any)[key] === 'function') {
      (mockSocketBase as any)[key] = (mockSocketBase as any)[key].bind(mockSocketBase);
    }
  });
  
  // Cast to Socket type
  return mockSocketBase as unknown as Socket;
};

// Socket initialization function - improved with better error handling
export const initSocket = async (): Promise<Socket> => {
  // Disconnect existing socket
  if (socket) {
    console.log('Disconnecting existing socket connection');
    socket.disconnect();
    socket = null;
  }
  
  const clientId = getClientId();
  console.log(`Initializing socket with client ID: ${clientId}`);
  
  // First try to create a real socket connection
  try {
    console.log(`Connecting to socket server at ${SERVER_URL}`);
    
    return new Promise((resolve) => {
      // Create a timeout to fall back to mock socket
      const connectionTimeout = setTimeout(() => {
        if (!socket?.connected) {
          console.log('Socket connection timeout - falling back to mock socket');
          socket = createMockSocket();
          resolve(socket);
        }
      }, 1500); // Reduced timeout for faster fallback
      
      // Attempt to connect to real server
      socket = io(SERVER_URL, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000,
        timeout: 2000, // Reduced timeout
        forceNew: true,
        query: { clientId }
      });
      
      // On successful connection
      socket.on('connect', () => {
        console.log('Socket connected successfully with ID:', socket?.id);
        clearTimeout(connectionTimeout);
        resolve(socket as Socket);
      });
      
      // On connection error
      socket.on('connect_error', (err) => {
        console.error('Socket connection error:', err);
        clearTimeout(connectionTimeout);
        
        console.log('Socket error, using mock socket implementation');
        socket = createMockSocket();
        resolve(socket);
      });
    });
  } catch (err) {
    console.error('Socket initialization error:', err);
    console.log('Using mock socket implementation due to error');
    socket = createMockSocket();
    return socket;
  }
};

// Export the current socket instance
export const getSocket = (): Socket | null => socket;
