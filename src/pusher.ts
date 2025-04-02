
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
        const channelData = JSON.stringify({
          user_id: getUserId(),
          user_info: { 
            name: getUsername()
          }
        });
        
        // Create a dummy auth signature that Pusher client will accept
        // Note: This is NOT secure for production use - you should use a real server
        callback(null, {
          auth: `${pusher.key}:${socketId}`,
          channel_data: channelData
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
