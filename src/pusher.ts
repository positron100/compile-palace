
import Pusher from "pusher-js";

// Initialize Pusher with your app key and cluster
const pusher = new Pusher("8ff9dd9dd0d8fd5a50a7", {
  cluster: "ap2",
  forceTLS: true,
  // For private channels, we need to provide an authorizer
  authorizer: (channel) => ({
    authorize: (socketId, callback) => {
      try {
        // For this demo, we're simulating a successful auth
        // In a production app, this would call your server
        const auth = {
          auth: `${pusher.key}:${Math.random().toString(36).substring(2, 15)}`,
          channel_data: JSON.stringify({
            user_id: localStorage.getItem('userId') || Date.now().toString(),
            user_info: { 
              name: localStorage.getItem('username') || 'Anonymous' 
            }
          })
        };
        
        callback(null, auth);
      } catch (err) {
        console.error('Pusher authorization error:', err);
        callback(new Error('Authorization failed'), null);
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
