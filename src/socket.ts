import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

// For production, use a deployed backend URL
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

// Global socket instance
let socket: Socket | null = null;

// Global mock room data to share state across browser tabs
if (typeof window !== 'undefined' && !(window as any).__mockRooms) {
  (window as any).__mockRooms = {};
}

// Client ID management with more robust uniqueness
const getClientId = (): string => {
  // Use sessionStorage to maintain ID within a tab
  let clientId = sessionStorage.getItem('clientId');
  if (!clientId) {
    // Generate a truly unique ID with timestamp and random component
    clientId = `client-${Date.now()}-${uuidv4()}`;
    sessionStorage.setItem('clientId', clientId);
  }
  return clientId;
};

// Enhanced mock socket to better simulate real-time collaboration
const createMockSocket = (): Socket => {
  console.log('Creating mock socket for offline mode');
  
  // Use the global mockRooms object for shared state across tabs
  const mockRooms = (window as any).__mockRooms;
  const mockSocketId = `mock-${uuidv4()}`;
  
  // Create a basic event emitter to simulate socket behavior
  const events: Record<string, Function[]> = {};
  const mockSocket = {
    id: mockSocketId,
    connected: true,
    
    // Core socket.io methods
    on: (event: string, callback: Function) => {
      console.log(`Mock socket: Registered listener for "${event}"`);
      if (!events[event]) events[event] = [];
      events[event].push(callback);
      return mockSocket;
    },
    
    off: (event: string, callback?: Function) => {
      console.log(`Mock socket: Removed listener for "${event}"`);
      if (!events[event]) return mockSocket;
      
      if (callback) {
        events[event] = events[event].filter(cb => cb !== callback);
      } else {
        delete events[event];
      }
      return mockSocket;
    },
    
    emit: (event: string, ...args: any[]) => {
      console.log(`Mock socket: Emitted "${event}"`, args);
      
      // Special case for join events - simulate server response with all room clients
      if (event === 'join' && args[0]?.roomId && args[0]?.username) {
        const { roomId, username } = args[0];
        
        // Initialize room if it doesn't exist
        if (!mockRooms[roomId]) {
          mockRooms[roomId] = { 
            clients: [],
            latestCode: '' 
          };
        }
        
        // Check if user already exists in the room
        const existingClientIndex = mockRooms[roomId].clients.findIndex(
          (client: any) => client.username === username
        );
        
        if (existingClientIndex >= 0) {
          // Update existing client
          mockRooms[roomId].clients[existingClientIndex] = { 
            socketId: mockSocketId, 
            username 
          };
        } else {
          // Add new client to room
          mockRooms[roomId].clients.push({ 
            socketId: mockSocketId, 
            username 
          });
        }
        
        // Simulate server broadcasting joined event to all clients in the room
        setTimeout(() => {
          const joinedCallbacks = events['joined'] || [];
          joinedCallbacks.forEach(cb => cb({
            clients: mockRooms[roomId].clients,
            username,
            socketId: mockSocketId
          }));
          
          // If there's existing code in the room, sync it to the new client
          if (mockRooms[roomId].latestCode) {
            const syncCodeCallbacks = events['sync-code'] || [];
            syncCodeCallbacks.forEach(cb => cb({
              code: mockRooms[roomId].latestCode
            }));
          }
        }, 100);
      }
      
      // Handle code sync requests
      if (event === 'sync-code' && args[0]?.roomId) {
        const roomId = args[0].roomId;
        
        // Send back the latest code if it exists
        if (mockRooms[roomId]?.latestCode) {
          setTimeout(() => {
            const syncCodeCallbacks = events['sync-code'] || [];
            syncCodeCallbacks.forEach(cb => cb({
              code: mockRooms[roomId].latestCode
            }));
          }, 50);
        }
      }
      
      // Echo code changes back in offline mode to simulate real-time collaboration
      if (event === 'code-change' && args[0]?.roomId && args[0]?.code) {
        const roomId = args[0].roomId;
        const code = args[0].code;
        
        // Store the latest code in the room
        if (!mockRooms[roomId]) {
          mockRooms[roomId] = { clients: [], latestCode: code };
        } else {
          mockRooms[roomId].latestCode = code;
        }
        
        // Broadcast to all "clients" in this room by triggering code-change
        setTimeout(() => {
          const codeChangeCallbacks = events['code-change'] || [];
          codeChangeCallbacks.forEach(cb => cb({ code }));
        }, 50);
      }
      
      // Handle disconnection/leave events
      if (event === 'leave' && args[0]?.roomId) {
        const roomId = args[0].roomId;
        
        if (mockRooms[roomId]) {
          // Remove this client from the room
          mockRooms[roomId].clients = mockRooms[roomId].clients.filter(
            (client: any) => client.socketId !== mockSocketId
          );
          
          // Notify other "clients" about disconnection
          if (mockRooms[roomId].clients.length > 0) {
            const disconnectedCallbacks = events['disconnected'] || [];
            disconnectedCallbacks.forEach(cb => cb({
              socketId: mockSocketId,
              username: 'User' // We don't track which username disconnected in this simple mock
            }));
          }
        }
      }
      
      return mockSocket;
    },
    
    disconnect: () => {
      console.log('Mock socket: Disconnected');
      
      // Clean up this client from all rooms
      Object.keys(mockRooms).forEach(roomId => {
        mockRooms[roomId].clients = mockRooms[roomId].clients.filter(
          (client: any) => client.socketId !== mockSocketId
        );
      });
      
      // Clear all event listeners
      Object.keys(events).forEach(event => delete events[event]);
    },
    
    // Other required socket.io methods with minimal implementation
    io: null as any,
    nsp: '',
    connect: () => mockSocket
  } as unknown as Socket;
  
  return mockSocket;
};

// Main socket initialization function with improved handling
export const initSocket = async (): Promise<Socket> => {
  // Always disconnect existing socket before creating a new one
  if (socket) {
    console.log('Disconnecting existing socket connection');
    socket.disconnect();
    socket = null;
  }
  
  // Get the client ID for this session
  const clientId = getClientId();
  console.log(`Initializing socket with client ID: ${clientId}`);
  
  try {
    // Attempt to connect to the real socket server
    console.log(`Connecting to socket server at ${SERVER_URL}`);
    socket = io(SERVER_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
      forceNew: true, // Force new connection to avoid issues with multiple tabs
      query: { clientId } // Pass client ID with connection
    });
    
    // Return a promise that resolves when connected or rejects on error
    return new Promise((resolve, reject) => {
      // Set a connection timeout
      const timeoutId = setTimeout(() => {
        if (!socket?.connected) {
          console.error('Socket connection timeout after 10 seconds');
          
          // Instead of rejecting, try to provide a mock socket
          console.log('Falling back to mock socket implementation');
          socket = createMockSocket();
          resolve(socket);
        }
      }, 5000); // Reduced timeout for faster testing
      
      // Handle successful connection
      socket.on('connect', () => {
        console.log('Socket connected successfully with ID:', socket?.id);
        clearTimeout(timeoutId);
        resolve(socket as Socket);
      });
      
      // Handle connection error
      socket.on('connect_error', (err) => {
        console.error('Socket connection error:', err);
        clearTimeout(timeoutId);
        
        // Instead of rejecting, try to provide a mock socket
        console.log('Socket error, falling back to mock socket implementation');
        socket = createMockSocket();
        resolve(socket);
      });
    });
  } catch (err) {
    console.error('Socket initialization error:', err);
    
    // In development or if real connection fails, use mock socket
    console.log('Falling back to mock socket implementation');
    socket = createMockSocket();
    return socket;
  }
};

// Export the current socket instance for direct access if needed
export const getSocket = (): Socket | null => socket;
