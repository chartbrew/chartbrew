const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const Redis = require("ioredis");
const { getRedisOptions } = require("../redisConnection");

/**
 * Socket.IO Manager for Chartbrew
 *
 * Handles real-time communication for AI orchestrations and other features.
 * Provides room-based isolation for teams/users and progress tracking.
 *
 * Uses Redis adapter for cross-process communication when Redis is available,
 * enabling proper scaling across multiple workers or nodes.
 */

class SocketManager {
  constructor() {
    this.io = null;
    this.activeConnections = new Map(); // userId -> socket
    this.roomConnections = new Map(); // room -> Set of socket IDs
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.NODE_ENV === "production"
          ? process.env.VITE_APP_CLIENT_HOST || false
          : process.env.VITE_APP_CLIENT_HOST_DEV || false,
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ["websocket", "polling"]
    });

    // Try to set up Redis adapter for cross-process communication
    try {
      const redisConfig = getRedisOptions();

      // Check if Redis is configured (host is set)
      if (redisConfig.host) {
        // Create Redis clients for pub/sub
        const pubClient = new Redis(redisConfig);
        const subClient = pubClient.duplicate();

        // Use Redis adapter for cross-process communication
        this.io.adapter(createAdapter(pubClient, subClient));

        console.log("Socket.IO Redis adapter enabled for cross-process communication"); // eslint-disable-line
      } else {
        console.log("Redis not configured, using in-memory adapter"); // eslint-disable-line
      }
    } catch (error) {
      console.warn("Failed to set up Redis adapter, using in-memory adapter:", error.message); // eslint-disable-line
    }

    this.setupConnectionHandling();
  }

  setupConnectionHandling() {
    this.io.on("connection", (socket) => {
      // Authentication middleware
      socket.on("authenticate", (data) => {
        const { userId, teamId } = data;
        if (!userId) {
          socket.emit("authenticated", { success: false, error: "User ID required" });
          return;
        }

        // Remove old connection for this user if exists
        const existingSocket = this.activeConnections.get(userId);
        if (existingSocket && existingSocket.id !== socket.id) {
          existingSocket.disconnect(true);
        }

        this.activeConnections.set(userId, socket);
        // eslint-disable-next-line no-param-reassign
        socket.userId = userId;
        // eslint-disable-next-line no-param-reassign
        socket.teamId = teamId;

        // Join team room for team-wide broadcasts
        if (teamId) {
          socket.join(`team:${teamId}`);
          this.addToRoom(`team:${teamId}`, socket.id);
        }

        // Join user room for private messages
        socket.join(`user:${userId}`);
        this.addToRoom(`user:${userId}`, socket.id);

        socket.emit("authenticated", { success: true });
      });

      // Handle conversation room joining
      socket.on("join-conversation", (data) => {
        const { conversationId } = data;
        if (!conversationId) {
          return;
        }

        if (!socket.userId) {
          // Not authenticated yet, queue this for after authentication
          return;
        }

        socket.join(`conversation:${conversationId}`);
        this.addToRoom(`conversation:${conversationId}`, socket.id);
      });

      // Handle conversation room leaving
      socket.on("leave-conversation", (data) => {
        const { conversationId } = data;
        if (conversationId) {
          socket.leave(`conversation:${conversationId}`);
          this.removeFromRoom(`conversation:${conversationId}`, socket.id);
        }
      });

      // Handle disconnection
      socket.on("disconnect", () => {
        // Clean up from rooms
        this.roomConnections.forEach((sockets) => {
          if (sockets.has(socket.id)) {
            sockets.delete(socket.id);
          }
        });

        // Clean up active connections
        if (socket.userId) {
          this.activeConnections.delete(socket.userId);
        }
      });
    });
  }

  addToRoom(room, socketId) {
    if (!this.roomConnections.has(room)) {
      this.roomConnections.set(room, new Set());
    }
    this.roomConnections.get(room).add(socketId);
  }

  removeFromRoom(room, socketId) {
    const roomSockets = this.roomConnections.get(room);
    if (roomSockets) {
      roomSockets.delete(socketId);
      if (roomSockets.size === 0) {
        this.roomConnections.delete(room);
      }
    }
  }

  // Emit progress events for AI orchestration
  emitProgress(conversationId, event, data = {}) {
    if (!this.io) return; // Skip if not initialized
    const room = `conversation:${conversationId}`;
    this.io.to(room).emit("ai-progress", {
      event,
      data,
      timestamp: new Date().toISOString()
    });
  }

  // Emit to specific user
  emitToUser(userId, event, data = {}) {
    if (!this.io) return; // Skip if not initialized
    const room = `user:${userId}`;
    this.io.to(room).emit(event, data);
  }

  // Emit to team
  emitToTeam(teamId, event, data = {}) {
    if (!this.io) return; // Skip if not initialized
    const room = `team:${teamId}`;
    this.io.to(room).emit(event, data);
  }

  // Get active connections count
  getActiveConnections() {
    return this.activeConnections.size;
  }

  // Get room connections count
  getRoomConnections(room) {
    const roomSockets = this.roomConnections.get(room);
    return roomSockets ? roomSockets.size : 0;
  }
}

// Export singleton instance
const socketManager = new SocketManager();
module.exports = socketManager;
