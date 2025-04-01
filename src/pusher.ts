
import Pusher from "pusher-js";

// Initialize Pusher with your app key and cluster
const pusher = new Pusher("8ff9dd9dd0d8fd5a50a7", {
  cluster: "ap2",
  forceTLS: true,
  // For private channels, we need to provide an authorizer
  authorizer: (channel) => ({
    authorize: (socketId, callback) => {
      // In a real application, this would be a server call
      // For this demo, we'll simulate a successful auth
      const auth = {
        auth: `${pusher.key}:${Math.random().toString(36).substring(2, 15)}`,
        channel_data: JSON.stringify({
          user_id: Date.now().toString(),
          user_info: { name: "Anonymous" }
        })
      };
      
      // Pass null instead of false for the error parameter
      // This fixes the TypeScript error
      callback(null, auth);
    }
  })
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
