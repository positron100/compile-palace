
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
      userSocketMap: {},
      roomCodeMap: {} // Store code for each room
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
      username: mockData.userSocketMap[socketId] || 'Anonymous',
    };
  });
};

// Enhanced mock socket to closely mirror the original server implementation
const createMockSocket = (): Socket => {
  console.log('Creating mock socket for offline mode');
  
  const mockData = (window as any).__mockData;
  const mockSocketId = `mock-${uuidv4()}`;
  const mockRooms = new Set<string>();
  
  // Create a function to broadcast to a room
  const broadcastToRoom = (roomId: string, event: string, data: any, excludeSelf = true) => {
    if (mockData.rooms[roomId]) {
      console.log(`Broadcasting "${event}" to room ${roomId}`, data);
      Array.from(mockData.rooms[roomId]).forEach((socketId: string) => {
        if (!excludeSelf || socketId !== mockSocketId) { 
          const callbacks = events[event] || [];
          callbacks.forEach(cb => setTimeout(() => cb(data), 10)); // Small delay to mimic network
        }
      });
    }
  };
  
  // Create event system to simulate socket behavior
  const events: Record<string, Function[]> = {};
  
  const mockSocket = {
    id: mockSocketId,
    connected: true,
    
    on: function(event: string, callback: Function) {
      console.log(`Mock socket: Registered listener for "${event}"`);
      if (!events[event]) events[event] = [];
      events[event].push(callback);
      return this;
    },
    
    off: function(event: string, callback?: Function) {
      console.log(`Mock socket: Removed listener for "${event}"`);
      if (!events[event]) return this;
      
      if (callback) {
        events[event] = events[event].filter(cb => cb !== callback);
      } else {
        delete events[event];
      }
      return this;
    },
    
    emit: function(event: string, ...args: any[]) {
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
        
        // Get all clients in room AFTER adding current user
        const clients = getAllConnectedClients(roomId);
        console.log(`Room ${roomId} now has clients:`, clients);
        
        // Broadcast JOINED event to all clients in room (including self)
        setTimeout(() => {
          // First broadcast to others that a new user joined
          broadcastToRoom(roomId, ACTIONS.JOINED, {
            clients,
            username,
            socketId: mockSocketId
          }, false); // Include self in this broadcast
          
          // Send current code to the new joiner if available
          if (mockData.roomCodeMap[roomId]) {
            const syncCallbacks = events[ACTIONS.SYNC_CODE] || [];
            syncCallbacks.forEach(cb => setTimeout(() => {
              cb({ code: mockData.roomCodeMap[roomId] });
            }, 50));
          }
        }, 50);
      }
      
      // Handle CODE_CHANGE event
      if (event === ACTIONS.CODE_CHANGE && args[0]?.roomId && args[0]?.code) {
        const { roomId, code } = args[0];
        
        // Store the code in the roomCodeMap
        mockData.roomCodeMap[roomId] = code;
        
        // Broadcast to all other clients in room
        setTimeout(() => {
          broadcastToRoom(roomId, ACTIONS.CODE_CHANGE, { code }, true);
        }, 10);
      }
      
      // Handle SYNC_CODE event - This is called when a client wants the current code
      if (event === ACTIONS.SYNC_CODE && args[0]?.roomId) {
        const { roomId } = args[0];
        console.log("Mock socket: SYNC_CODE request received for room", roomId);
        
        // Send the stored code for this room if available
        setTimeout(() => {
          const code = mockData.roomCodeMap[roomId] || "";
          const syncCallbacks = events[ACTIONS.SYNC_CODE] || [];
          syncCallbacks.forEach(cb => cb({ code }));
        }, 30);
      }
      
      return this;
    },
    
    join: function(roomId: string) {
      console.log(`Mock socket: Joining room ${roomId}`);
      mockRooms.add(roomId);
      if (!mockData.rooms[roomId]) {
        mockData.rooms[roomId] = new Set();
      }
      mockData.rooms[roomId].add(mockSocketId);
      return this;
    },
    
    to: function(room: string) {
      return {
        emit: (event: string, data: any) => {
          broadcastToRoom(room, event, data, true);
        }
      };
    },
    
    in: function(room: string) {
      return this.to(room);
    },
    
    disconnect: function() {
      console.log('Mock socket: Disconnecting...');
      
      // Broadcast DISCONNECTED to all rooms this socket is in
      mockRooms.forEach((roomId) => {
        if (mockData.rooms[roomId]) {
          const username = mockData.userSocketMap[mockSocketId] || 'Anonymous';
          
          // Remove this socket from the room first
          mockData.rooms[roomId].delete(mockSocketId);
          
          // Then broadcast the disconnection to remaining users
          broadcastToRoom(roomId, ACTIONS.DISCONNECTED, {
            socketId: mockSocketId,
            username
          }, true);
          
          // Clean up empty rooms
          if (mockData.rooms[roomId].size === 0) {
            delete mockData.rooms[roomId];
            delete mockData.roomCodeMap[roomId];
          }
        }
      });
      
      // Remove from user socket map
      delete mockData.userSocketMap[mockSocketId];
      mockRooms.clear();
      
      // Clear all event listeners
      Object.keys(events).forEach(event => delete events[event]);
    }
  };
  
  // Add standard socket.io fields and methods
  const extendedMockSocket = {
    ...mockSocket,
    connect: () => mockSocket,
    io: { engine: { id: mockSocketId } },
    nsp: '/',
    volatile: { emit: () => mockSocket },
    timeout: () => ({ emit: () => Promise.resolve() }),
    send: () => mockSocket,
    binary: () => mockSocket,
    compress: () => mockSocket,
    emitWithAck: () => Promise.resolve(),
    listeners: () => [],
    hasListeners: () => false,
    onAny: () => mockSocket,
    prependAny: () => mockSocket,
    offAny: () => mockSocket,
    listenersAny: () => [],
    eventNames: () => [],
    decorate: () => mockSocket
  };
  
  // Cast to Socket type
  return extendedMockSocket as unknown as Socket;
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
      }, 800); // Shorter timeout for faster fallback
      
      // Attempt to connect to real server
      socket = io(SERVER_URL, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 500,
        timeout: 1000, // Shortened timeout
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
