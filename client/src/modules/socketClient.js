import { io } from "socket.io-client";
import { API_HOST } from "../config/settings";

/**
 * Singleton Socket.IO client for Chartbrew AI
 * Handles connection, authentication, and room management
 */
class SocketClient {
  constructor() {
    this.socket = null;
    this.isAuthenticated = false;
    this.userId = null;
    this.teamId = null;
    this.listeners = new Map(); // Track all event listeners for cleanup
    this.conversationRooms = new Set(); // Track joined conversation rooms
  }

  /**
   * Initialize socket connection with authentication
   * @param {number} userId - User ID
   * @param {number} teamId - Team ID
   * @returns {Promise<void>}
   */
  async connect(userId, teamId) {
    // If already connected with same credentials, reuse connection
    if (this.socket?.connected && this.isAuthenticated && this.userId === userId && this.teamId === teamId) {
      return Promise.resolve();
    }

    // Disconnect existing socket if credentials changed
    if (this.socket && (this.userId !== userId || this.teamId !== teamId)) {
      this.disconnect();
    }

    this.userId = userId;
    this.teamId = teamId;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Socket connection timeout"));
      }, 10000);

      this.socket = io(API_HOST, {
        withCredentials: true,
        transports: ["websocket", "polling"], // Allow fallback for production
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 8000,
        autoConnect: true,
      });

      // Handle connection
      this.socket.on("connect", () => {
        // Authenticate immediately after connect
        this.socket.emit("authenticate", { userId, teamId });
      });

      // Handle successful authentication
      this.socket.once("authenticated", () => {
        clearTimeout(timeout);
        this.isAuthenticated = true;
        resolve();
      });

      // Handle connection errors
      this.socket.on("connect_error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      // Handle disconnection
      this.socket.on("disconnect", (reason) => {
        this.isAuthenticated = false;
        // If server disconnected us, try to reconnect
        if (reason === "io server disconnect") {
          this.socket.connect();
        }
      });

      // Handle reconnection
      this.socket.on("reconnect", () => {
        // Re-authenticate after reconnection
        this.socket.emit("authenticate", { userId, teamId });
        
        // Rejoin all conversation rooms
        this.conversationRooms.forEach((conversationId) => {
          this.socket.emit("join-conversation", { conversationId });
        });
      });
    });
  }

  /**
   * Disconnect socket
   */
  disconnect() {
    if (this.socket) {
      // Remove all listeners
      this.listeners.forEach((handler, event) => {
        this.socket.off(event, handler);
      });
      this.listeners.clear();
      this.conversationRooms.clear();
      
      this.socket.disconnect();
      this.socket = null;
      this.isAuthenticated = false;
    }
  }

  /**
   * Join a conversation room
   * @param {number} conversationId - Conversation ID
   */
  joinConversation(conversationId) {
    if (!this.socket || !this.isAuthenticated) {
      console.warn("Cannot join conversation: socket not authenticated");
      return;
    }

    this.socket.emit("join-conversation", { conversationId });
    this.conversationRooms.add(conversationId);
  }

  /**
   * Leave a conversation room
   * @param {number} conversationId - Conversation ID
   */
  leaveConversation(conversationId) {
    if (!this.socket) return;

    this.socket.emit("leave-conversation", { conversationId });
    this.conversationRooms.delete(conversationId);
  }

  /**
   * Add event listener
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  on(event, handler) {
    if (!this.socket) {
      console.warn("Cannot add listener: socket not initialized");
      return;
    }

    this.socket.on(event, handler);
    this.listeners.set(event + handler.toString(), handler);
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  off(event, handler) {
    if (!this.socket) return;

    this.socket.off(event, handler);
    this.listeners.delete(event + handler.toString());
  }

  /**
   * Check if socket is connected and authenticated
   * @returns {boolean}
   */
  isReady() {
    return this.socket?.connected && this.isAuthenticated;
  }
}

// Export singleton instance
const socketClient = new SocketClient();
export default socketClient;

