# Multiplayer Game

A real-time multiplayer web application built with Node.js and Socket.IO.

## Features

- **Host Panel**: Control the game and monitor all connected players
- **Player Interface**: Join games and send actions to the host
- **Real-time Communication**: Instant messaging using WebSocket connections
- **Connection Management**: Handles player joins/leaves gracefully

## Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/multiplayer-game.git
   cd multiplayer-game
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   node server.js
   ```

4. **Open your browser:**
   - Go to `http://localhost:3000`
   - Choose to join as Host or Player

## How to Play

### For Hosts:
1. Go to `http://localhost:3000/host.html`
2. Click "Connect as Host"
3. Monitor players and their actions
4. Send messages to all players

### For Players:
1. Go to `http://localhost:3000/player.html`
2. Enter your name and join the game
3. Click action buttons to send actions to the host
4. Receive messages from the host

## File Structure

```
multiplayer-game/
├── server.js          # Main server file
├── package.json       # Dependencies and scripts
└── public/            # Client-side files
    ├── index.html     # Landing page
    ├── host.html      # Host interface
    └── player.html    # Player interface
```

## Technologies Used

- **Backend**: Node.js, Express.js, Socket.IO
- **Frontend**: HTML, CSS, JavaScript
- **Real-time Communication**: WebSocket connections

## Next Steps

This is a basic foundation. You can extend it by adding:
- Game-specific logic and rules
- Player scoring system
- Multiple game rooms
- Game state persistence
- Mobile-responsive design
- Authentication system

## Contributing

Feel free to fork this project and submit pull requests with improvements!

## License

MIT License - feel free to use this code for your own projects.


##

This is a project teaching me how to use these features with the assistance of Claude AI.