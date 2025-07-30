const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { permission } = require('process');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static('public'));

// Simple game state
let gameState = {
  host: null,
  players: {},
  isGameActive: false
};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle joining as host
  socket.on('join-as-host', () => {
    if (gameState.host === null) {
      gameState.host = socket.id;
      socket.join('host');
      socket.emit('role-assigned', { role: 'host', success: true });
      console.log('Host assigned:', socket.id);
    } else {
      socket.emit('role-assigned', { role: 'host', success: false, message: 'Host already exists' });
    }
  });

  // Handle joining as player
  socket.on('join-as-player', (playerName) => {
    const playerId = socket.id;
    gameState.players[playerId] = {
      name: playerName || `Player ${Object.keys(gameState.players).length + 1}`,
      id: playerId
    };
    
    socket.join('players');
    socket.emit('role-assigned', { 
      role: 'player', 
      success: true, 
      playerData: gameState.players[playerId] 
    });

    // Notify host about new player
    if (gameState.host) {
      io.to(gameState.host).emit('player-joined', gameState.players[playerId]);
      io.to(gameState.host).emit('game-state-update', { players: gameState.players });
    }

    console.log('Player joined:', gameState.players[playerId]);
  });

  // Handle player actions
  socket.on('player-action', (action) => {
    console.log('Player action received:', action);
    
    // Forward action to host
    if (gameState.host) {
      io.to(gameState.host).emit('player-action', {
        playerId: socket.id,
        playerName: gameState.players[socket.id]?.name,
        action: action
      });
    }
  });

  // Handle host messages to players
  socket.on('host-message', (message) => {
    console.log('Host message:', message);
    io.to('players').emit('host-message', message);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // If host disconnects
    if (gameState.host === socket.id) {
      gameState.host = null;
      io.to('players').emit('host-disconnected');
    }
    
    // If player disconnects
    if (gameState.players[socket.id]) {
      const playerName = gameState.players[socket.id].name;
      delete gameState.players[socket.id];
      
      // Notify host
      if (gameState.host) {
        io.to(gameState.host).emit('player-left', { playerId: socket.id, playerName });
        io.to(gameState.host).emit('game-state-update', { players: gameState.players });
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} to test`);
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