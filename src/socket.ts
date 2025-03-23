
import { io } from 'socket.io-client';

export const initSocket = () => {
  // For local development
  const options = {
    'force new connection': true,
    reconnectionAttempt: 'Infinity',
    timeout: 10000,
    transports: ['websocket'],
  };
  
  // In production, you would use something like:
  // return io(process.env.REACT_APP_BACKEND_URL, options);
  
  // For now, let's use localhost:5000 for development
  return io('http://localhost:5000', options);
};
