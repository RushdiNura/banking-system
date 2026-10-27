import { io } from "socket.io-client";
import { getAccessToken } from "./api";

let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

export const connectSocket = () => {
  const token = getAccessToken();
  if (!token) return null;
  if (socket?.connected) return socket;

  const SOCKET_URL =
    import.meta.env.VITE_SOCKET_URL ||
    (import.meta.env.MODE === "production"
      ? window.location.origin
      : "http://localhost:5000");

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });

  socket.on("connect", () => {
    console.log("✅ Socket connected:", socket.id);
    reconnectAttempts = 0;
  });

  socket.on("disconnect", (reason) => {
    console.log("❌ Socket disconnected:", reason);
    if (reason === "io server disconnect") socket.connect();
  });

  socket.on("connect_error", (error) => {
    reconnectAttempts++;
    console.warn("Socket connection error:", error.message);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    reconnectAttempts = 0;
  }
};

export const getSocket = () => socket;
export const isSocketConnected = () => !!socket?.connected;
