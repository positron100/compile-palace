
import Pusher from "pusher-js";

// Initialize Pusher with your app key and cluster
const pusher = new Pusher("8ff9dd9dd0d8fd5a50a7", {
  cluster: "ap2",
  forceTLS: true,
  enabledTransports: ["ws", "wss"], // Only use WebSocket protocols
  disabledTransports: ["xhr_streaming", "xhr_polling", "sockjs"], // Disable polling to prevent CORS issues
  activityTimeout: 120000, // 2 minutes
  pongTimeout: 30000, // 30 seconds
  wsHost: undefined, // Use default Pusher host
  wsPort: 443,
  wssPort: 443,
  httpHost: undefined, // Use default Pusher host
  httpPort: 80,
  httpsPort: 443,
  authEndpoint: undefined, // Don't use auth endpoint to avoid CORS
  auth: undefined,
  authorizer: undefined,
  // We can't use 'client' property as it's not in the Options type
  // Use standard encryption option instead
  encrypted: true
});

// Enable debug logging in development mode
if (import.meta.env.DEV) {
  Pusher.logToConsole = true;
}

// Add event listeners for connection status
pusher.connection.bind('connecting', () => {
  console.log('Connecting to Pusher...');
});

pusher.connection.bind('connected', () => {
  console.log('Successfully connected to Pusher!');
});

pusher.connection.bind('unavailable', () => {
  console.log('Pusher connection unavailable');
});

pusher.connection.bind('failed', () => {
  console.error('Pusher connection failed');
});

pusher.connection.bind('disconnected', () => {
  console.log('Disconnected from Pusher');
  
  // Attempt reconnection after a short delay
  setTimeout(() => {
    console.log('Attempting to reconnect to Pusher...');
    pusher.connect();
  }, 3000);
});

pusher.connection.bind('error', (err) => {
  console.error('Pusher connection error:', err);
});

export default pusher;
