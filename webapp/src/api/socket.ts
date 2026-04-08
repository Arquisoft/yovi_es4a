import { io } from "socket.io-client";

// The Nginx gateway handles /api/users/* routing to the users backend
export const socket = io({
  path: "/api/users/socket.io",
  autoConnect: false, // We'll manually connect when entering multiplayer
});
