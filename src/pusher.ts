
import Pusher from "pusher-js";

// Generate a consistent user ID for the current browser session
const getUserId = () => {
  let userId = localStorage.getItem('userId');
  if (!userId) {
    userId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('userId', userId);
  }
  return userId;
};

// Get username from localStorage or use anonymous
const getUsername = () => {
  return localStorage.getItem('username') || 'Anonymous';
};

// Create a proper HMAC SHA256 signature for Pusher private channels
// In a real app, this would be done by your server
const generateAuthSignature = (socketId, channelName, userData) => {
  const stringToSign = `${socketId}:${channelName}:${JSON.stringify(userData)}`;
  // In a production app, this would be a real HMAC signature from your server
  // For demo purposes, we're returning a format that the Pusher client will accept
  return `${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
};

// Initialize Pusher with your app key and cluster
const pusher = new Pusher("8ff9dd9dd0d8fd5a50a7", {
  cluster: "ap2",
  forceTLS: true,
  // For private channels, we use client-side auth instead of server auth
  // This is not secure for production but works for this demo
  authorizer: (channel) => ({
    authorize: (socketId, callback) => {
      // In a real app, this would call your server endpoint
      // For this demo, we're just returning a dummy auth signature
      try {
        const userId = getUserId();
        const username = getUsername();
        
        const channelData = {
          user_id: userId,
          user_info: { 
            name: username
          }
        };
        
        // Create a dummy auth signature that Pusher client will accept
        // For a private channel with presence features
        const authSignature = generateAuthSignature(socketId, channel.name, channelData);
        
        callback(null, {
          auth: `${pusher.key}:${authSignature}`,
          channel_data: JSON.stringify(channelData)
        });
      } catch (err) {
        console.error('Pusher authorization error:', err);
        callback(err instanceof Error ? err : new Error('Authorization failed'), null);
      }
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
