import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('Browser connected');
});

server.listen(process.env.PORT || 3001, () => {
    console.log('Server running');
});
