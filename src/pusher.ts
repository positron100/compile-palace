
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

/**
 * Determines the type of Pusher channel based on its name
 * @param channelName The name of the channel
 * @returns 'public', 'private', or 'presence'
 */
export const getChannelType = (channelName: string): 'public' | 'private' | 'presence' => {
  if (channelName.startsWith('private-')) {
    return 'private';
  } else if (channelName.startsWith('presence-')) {
    return 'presence';
  } else {
    return 'public';
  }
};

// Initialize Pusher with your app key and cluster
const pusher = new Pusher("8ff9dd9dd0d8fd5a50a7", {
  cluster: "ap2",
  forceTLS: true
  // No authorizer needed for public channels
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
