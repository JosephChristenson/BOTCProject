const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static('public'));

// Game rooms storage
let gameRooms = {};

// Helper function to generate room codes
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Helper function to get room info for lobby list
function getPublicRoomsList() {
  return Object.values(gameRooms)
    .filter(room => room.isPublic && !room.gameStarted)
    .map(room => ({
      roomCode: room.roomCode,
      gameName: room.gameName,
      hostName: room.hostName,
      playerCount: Object.keys(room.players).length,
      maxPlayers: room.maxPlayers,
      createdAt: room.createdAt
    }));
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Get list of available games
  socket.on('get-game-list', () => {
    socket.emit('game-list-update', getPublicRoomsList());
  });

  // Create a new game room
  socket.on('create-game', (gameData) => {
    const roomCode = generateRoomCode();
    const room = {
      roomCode: roomCode,
      gameName: gameData.gameName || 'Untitled Game',
      hostName: gameData.hostName || 'Anonymous Host',
      hostId: socket.id,
      players: {},
      maxPlayers: gameData.maxPlayers || 6,
      isPublic: gameData.isPublic !== false,
      gameStarted: false,
      createdAt: new Date()
    };

    gameRooms[roomCode] = room;
    socket.join(roomCode);
    socket.join(`${roomCode}-host`);

    socket.emit('game-created', {
      success: true,
      roomCode: roomCode,
      gameData: room
    });

    // Broadcast updated game list to lobby
    io.emit('game-list-update', getPublicRoomsList());
    console.log(`Game created: ${room.gameName} (${roomCode}) by ${room.hostName}`);
  });

  // Join an existing game
  socket.on('join-game', (joinData) => {
    const { roomCode, playerName } = joinData;
    
    console.log(`Join attempt: ${playerName} trying to join ${roomCode}`);
    
    const room = gameRooms[roomCode];

    if (!room) {
      console.log(`Join failed: Room ${roomCode} not found`);
      socket.emit('join-result', {
        success: false,
        message: 'Game not found. Please check the room code.'
      });
      return;
    }

    if (room.gameStarted) {
      console.log(`Join failed: Game ${roomCode} already started`);
      socket.emit('join-result', {
        success: false,
        message: 'Game has already started.'
      });
      return;
    }

    if (Object.keys(room.players).length >= room.maxPlayers) {
      console.log(`Join failed: Game ${roomCode} is full`);
      socket.emit('join-result', {
        success: false,
        message: 'Game is full.'
      });
      return;
    }

    // Add player to room
    const player = {
      id: socket.id,
      name: playerName || `Player ${Object.keys(room.players).length + 1}`,
      joinedAt: new Date()
    };

    room.players[socket.id] = player;
    socket.join(roomCode);
    socket.join(`${roomCode}-players`);

    console.log(`Join successful: ${player.name} joined ${room.gameName} (${roomCode})`);

    socket.emit('join-result', {
      success: true,
      roomCode: roomCode,
      playerData: player,
      gameData: {
        gameName: room.gameName,
        hostName: room.hostName,
        playerCount: Object.keys(room.players).length,
        maxPlayers: room.maxPlayers
      }
    });

    // Notify host and other players
    socket.to(room.hostId).emit('player-joined', player);
    socket.to(roomCode).emit('room-update', {
      playerCount: Object.keys(room.players).length,
      players: Object.values(room.players)
    });

    // Update public game list
    io.emit('game-list-update', getPublicRoomsList());
  });

  // Handle player actions
  socket.on('player-action', (action) => {
    // Find which room this player is in
    const playerRoom = Object.values(gameRooms).find(room => 
      room.players[socket.id]
    );

    if (playerRoom) {
      const player = playerRoom.players[socket.id];
      console.log(`Player action from ${player.name}:`, action);
      
      // Forward action to host
      io.to(playerRoom.hostId).emit('player-action', {
        playerId: socket.id,
        playerName: player.name,
        roomCode: playerRoom.roomCode,
        action: action
      });
    }
  });

  // Handle host messages to players
  socket.on('host-message', (messageData) => {
    const { roomCode, message } = messageData;
    const room = gameRooms[roomCode];

    if (room && room.hostId === socket.id) {
      console.log(`Host message in ${roomCode}:`, message);
      io.to(`${roomCode}-players`).emit('host-message', {
        message: message,
        timestamp: new Date()
      });
    }
  });

  // Start game (host only)
  socket.on('start-game', (roomCode) => {
    const room = gameRooms[roomCode];
    if (room && room.hostId === socket.id) {
      room.gameStarted = true;
      io.to(roomCode).emit('game-started');
      io.emit('game-list-update', getPublicRoomsList());
      console.log(`Game started: ${room.gameName} (${roomCode})`);
    }
  });

  // Get room info for reconnection
  socket.on('get-room-info', (roomCode) => {
    const room = gameRooms[roomCode];
    if (room) {
      // Check if this socket is the host
      if (room.hostId === socket.id) {
        socket.emit('host-room-info', {
          roomCode: roomCode,
          gameName: room.gameName,
          hostName: room.hostName,
          playerCount: Object.keys(room.players).length,
          maxPlayers: room.maxPlayers,
          gameStarted: room.gameStarted,
          players: Object.values(room.players)
        });
      } else {
        socket.emit('room-info', {
          gameName: room.gameName,
          hostName: room.hostName,
          playerCount: Object.keys(room.players).length,
          maxPlayers: room.maxPlayers,
          gameStarted: room.gameStarted,
          players: Object.values(room.players)
        });
      }
    } else {
      socket.emit('room-not-found');
    }
  });

  // Handle host reconnection to existing room
  socket.on('reconnect-as-host', (roomCode) => {
    const room = gameRooms[roomCode];
    if (room && room.hostId === socket.id) {
      // Host is reconnecting to their own room
      socket.join(roomCode);
      socket.join(`${roomCode}-host`);
      
      socket.emit('host-reconnected', {
        roomCode: roomCode,
        gameName: room.gameName,
        hostName: room.hostName,
        playerCount: Object.keys(room.players).length,
        maxPlayers: room.maxPlayers,
        gameStarted: room.gameStarted,
        players: Object.values(room.players)
      });
    }
  });


const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Open http://localhost:${PORT} to test`);
  }
});

// list of characters currently supported. Updated list when game starts
const roles = {

  'washerwoman': {
    permissions: [], // no permissions needed.
    icon: '/icons/Icon_washerwoman.png',
    role: 'townsfolk',
    displayName: 'Washer Woman'
  },



  
  'poisoner': {
    permissions: ['poisontarget'],
    icon: '/icons/Icon_poisoner.png',
    role: 'minion',
    displayName: 'poisoner'
  },
  'spy': {
    permissions: ['grimlook', 'falsetown', 'falseoutsider'],
    icon: '/icons/Icon_spy.png',
    role: 'minion',
    displayName: 'spy'
  },
  'baron': {
    permissions: [],
    icon: '/icons/Icon_baron.png',
    role: 'minion',
    displayName: 'baron'
  },
  'scarletwoman': {
    permissions: [],
    icon: '/icons/Icon_scarletwoman.png',
    role: 'minion',
    displayName: 'scarletwoman'
  },
  'imp': {
    permissions: ['demonkill', 'starpass'],
    icon: '/icons/Icon_imp.png',
    role: 'demon',
    displayName: 'imp'
  }
}

// basic alive, dead and special section.
const stateRoles = {
  'alive': { // player is alive. Can vote, nominate and publicly declare statements.
    name: 'Alive',
    icon: 'heart-pulse',
    color: '#00FF00',
    permissions: ['move', 'interact', 'communicate', 'use_items']
  },
  'dead': {
    name: 'Dead', 
    icon: 'skull',
    color: '#808080',
    permissions: ['spectate', 'ghost_communicate']
  },
  'unconscious': {
    name: 'Unconscious',
    icon: 'sleep',
    color: '#FFAA00', 
    permissions: ['await_revival']
  }
}