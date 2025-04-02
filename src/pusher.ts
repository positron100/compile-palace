
import Pusher from "pusher-js";
import crypto from 'crypto-js';

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
  // For this demo, we're using a client-side secret
  // In production, this would be done server-side with a proper secret
  const demoSecret = 'pusher-demo-secret-key';
  
  // Format the string to sign exactly as Pusher expects it
  const stringToSign = `${socketId}:${channelName}:${JSON.stringify(userData)}`;
  
  // Generate the HMAC SHA256 signature using crypto-js
  const hmacSignature = crypto.HmacSHA256(stringToSign, demoSecret).toString(crypto.enc.Hex);
  
  return hmacSignature;
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
      // For this demo, we're just generating a dummy auth signature
      try {
        const userId = getUserId();
        const username = getUsername();
        
        const channelData = {
          user_id: userId,
          user_info: { 
            name: username
          }
        };
        
        // Create an auth signature for Pusher
        const authSignature = generateAuthSignature(socketId, channel.name, channelData);
        
        // Return the auth object with the signature and channel data
        callback(null, {
          auth: `${pusher.key}:${authSignature}`,
          channel_data: JSON.stringify(channelData)
        });
      } catch (err) {
        console.error('Pusher authorization error:', err);
        callback(err instanceof Error ? err : new Error('Authorization failed'));
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
