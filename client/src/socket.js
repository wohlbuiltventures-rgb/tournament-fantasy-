import { io } from 'socket.io-client';

const socket = io('/', {
  autoConnect: false,
});

export function connectSocket(token) {
  socket.auth = { token };
  if (!socket.connected) {
    socket.connect();
  }
}

export default socket;
