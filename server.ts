import { handler } from './build/handler.js';
import express from 'express';
import { createServer } from 'http';
import injectSocketIO from './src/lib/server/socketHandler';

const app = express();
const server = createServer(app);

// Inject Socket.IO
injectSocketIO(server);

// SvelteKit handler
app.use(handler);

server.listen(3000, () => {
  console.log('Listening on port 3000');
});
