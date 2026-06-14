import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { WebcastPushConnection } from 'tiktok-live-connector';

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*'
    }
});

app.use(express.static('public'));

const connections = new Map();

app.get('/connect', async (req, res) => {

    const username = req.query.user;

    if (!username) {
        return res.status(400).json({
            success: false,
            message: 'Parameter user wajib diisi'
        });
    }

    try {

        if (connections.has(username)) {
            return res.json({
                success: true,
                message: 'Sudah terkoneksi',
                username
            });
        }

        const tiktokLive = new WebcastPushConnection(username, {
            processInitialData: true,
            enableExtendedGiftInfo: true,
            requestPollingIntervalMs: 2000,

            signApiKey: process.env.EULER_API_KEY
        });

        await tiktokLive.connect();

        console.log(`CONNECTED => ${username}`);

        connections.set(username, tiktokLive);

        tiktokLive.on('chat', data => {

            io.emit('chat', {
                username,
                nickname: data.nickname,
                comment: data.comment
            });

        });

        tiktokLive.on('like', data => {

            io.emit('like', {
                username,
                nickname: data.nickname,
                likeCount: data.likeCount,
                totalLikeCount: data.totalLikeCount
            });

        });

        tiktokLive.on('follow', data => {

            io.emit('follow', {
                username,
                nickname: data.nickname
            });

        });

        tiktokLive.on('share', data => {

            io.emit('share', {
                username,
                nickname: data.nickname
            });

        });

        tiktokLive.on('member', data => {

            io.emit('join', {
                username,
                nickname: data.nickname
            });

        });

        tiktokLive.on('gift', data => {

            io.emit('gift', {
                username,
                nickname: data.nickname,
                giftName: data.giftName,
                repeatCount: data.repeatCount
            });

        });

        tiktokLive.on('streamEnd', () => {

            console.log(`LIVE ENDED => ${username}`);

            connections.delete(username);

            io.emit('streamEnd', {
                username
            });

        });

        res.json({
            success: true,
            username,
            message: 'Berhasil connect'
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

});

app.get('/disconnect', async (req, res) => {

    const username = req.query.user;

    if (!connections.has(username)) {
        return res.json({
            success: false,
            message: 'Tidak ditemukan'
        });
    }

    try {

        const connection = connections.get(username);

        connection.disconnect();

        connections.delete(username);

        res.json({
            success: true,
            username,
            message: 'Disconnected'
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

});

app.get('/status', (req, res) => {

    res.json({
        success: true,
        totalConnections: connections.size,
        rooms: [...connections.keys()]
    });

});

io.on('connection', socket => {

    console.log('Browser connected');

    socket.emit('welcome', {
        message: 'Connected to server'
    });

    socket.on('disconnect', () => {
        console.log('Browser disconnected');
    });

});

server.listen(process.env.PORT || 3001, () => {

    console.log(`SERVER RUNNING ON PORT ${process.env.PORT || 3001}`);

});
