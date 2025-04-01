
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import ACTIONS from './Actions';

// For production, use a deployed backend URL or just disable socket.io
// The app should prioritize Pusher for real-time communication
const SERVER_URL = import.meta.env.VITE_SERVER_URL || null; // Set to null if no server URL provided

// Global socket instance
let socket: Socket | null = null;

// Flag to indicate if we already tried to connect and failed
let connectionAttempted = false;

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
        
        // Validate username and set a default if needed
        const validUsername = username || 'Anonymous';
        
        // Add user to socket map (like userSocketMap on server)
        mockData.userSocketMap[mockSocketId] = validUsername;
        
        // Add socket to room
        if (!mockData.rooms[roomId]) {
          mockData.rooms[roomId] = new Set();
          console.log(`Created new room: ${roomId}`);
        }
        mockData.rooms[roomId].add(mockSocketId);
        mockRooms.add(roomId);
        
        // Get all clients in room AFTER adding current user
        const clients = getAllConnectedClients(roomId);
        console.log(`Room ${roomId} now has clients:`, clients);
        
        // Broadcast JOINED event to all clients in room (including self)
        setTimeout(() => {
          // First broadcast to others that a new user joined
          const joinedData = {
            clients,
            username: validUsername,
            socketId: mockSocketId
          };
          console.log("Broadcasting JOINED event with data:", joinedData);
          
          // Broadcast to everyone in the room including self
          Array.from(mockData.rooms[roomId]).forEach((socketId: string) => {
            const callbacks = events[ACTIONS.JOINED] || [];
            callbacks.forEach(cb => setTimeout(() => cb(joinedData), 10));
          });
          
          // Also emit a presence update event
          const presenceCallbacks = events[ACTIONS.PRESENCE_UPDATE] || [];
          presenceCallbacks.forEach(cb => setTimeout(() => cb({
            clients,
            count: clients.length
          }), 15));
          
          // And a subscription count update
          const subCountCallbacks = events[ACTIONS.SUBSCRIPTION_COUNT] || [];
          subCountCallbacks.forEach(cb => setTimeout(() => cb({
            roomId,
            subscription_count: clients.length
          }), 20));
          
          // Send current code to the new joiner if available
          if (mockData.roomCodeMap[roomId]) {
            console.log(`Sending current code for room ${roomId} to new user`);
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
          console.log(`Sending code for room ${roomId}: ${code.substring(0, 20)}...`);
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

// Socket initialization function - improved with better error handling and feedback
export const initSocket = async (): Promise<Socket> => {
  // If we already have a socket and it's connected, reuse it
  if (socket && socket.connected) {
    console.log('Reusing existing socket connection');
    return socket;
  }
  
  // Disconnect existing socket if it exists but isn't connected
  if (socket) {
    console.log('Disconnecting existing socket connection');
    socket.disconnect();
    socket = null;
  }
  
  const clientId = getClientId();
  console.log(`Initializing socket with client ID: ${clientId}`);
  
  // If localStorage has debug flag set, use mock socket immediately
  if (localStorage.getItem('forceMockSocket') === 'true') {
    console.log('Force mock socket mode is enabled via localStorage');
    socket = createMockSocket();
    return socket;
  }
  
  // Mark that we've attempted a connection
  connectionAttempted = true;
  
  // If no server URL is set or we're in Pusher mode, use mock socket
  if (!SERVER_URL) {
    console.log('No socket server URL defined, using mock socket implementation');
    socket = createMockSocket();
    return socket;
  }
  
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
      }, 1000); // Use 1 second timeout for quick fallback
      
      // Attempt to connect to real server
      socket = io(SERVER_URL, {
        transports: ['websocket', 'polling'], // Try WebSocket first, then polling
        reconnection: false, // Don't auto-reconnect, we'll handle it manually
        timeout: 2000,
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

// Debug helper: Force mock socket mode
export const forceMockSocket = (enable: boolean = true) => {
  if (enable) {
    localStorage.setItem('forceMockSocket', 'true');
    console.log('Mock socket mode forced ON. Reload the page to apply.');
  } else {
    localStorage.removeItem('forceMockSocket');
    console.log('Mock socket mode forced OFF. Reload the page to apply.');
  }
};

// Export the current socket instance
export const getSocket = (): Socket | null => socket;
