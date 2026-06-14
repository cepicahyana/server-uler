import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import { WebcastPushConnection } from 'tiktok-live-connector';

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*'
    }
});

const DEPLOY_TOKEN = process.env.DEPLOY_TOKEN || '';
const DEPLOY_SCRIPT = '/usr/local/bin/uler-deploy.sh';

const connections = new Map();

app.use(express.static('public'));


// =========================
// DEPLOY ENDPOINT
// =========================

app.get('/deploy/:token', (req, res) => {

    if (!DEPLOY_TOKEN || req.params.token !== DEPLOY_TOKEN) {
        return res.status(403).send('Forbidden');
    }

    const child = spawn('/bin/bash', [DEPLOY_SCRIPT], {
        detached: true,
        stdio: 'ignore'
    });

    child.unref();

    return res.status(202).send('Deploy started');
});


// =========================
// STATUS
// =========================

app.get('/status', (req, res) => {

    res.json({
        success: true,
        totalConnections: connections.size,
        rooms: [...connections.keys()]
    });

});


// =========================
// CONNECT TIKTOK LIVE
// =========================

app.get('/connect', async (req, res) => {

    const username = req.query.user;

    if (!username) {
        return res.status(400).json({
            success: false,
            message: 'user parameter required'
        });
    }

    try {

        if (connections.has(username)) {

            return res.json({
                success: true,
                message: 'already connected',
                username
            });

        }

        console.log(`Connecting ${username}`);

        const tiktokLive = new WebcastPushConnection(username, {
            processInitialData: true,
            enableExtendedGiftInfo: true,
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

            io.emit('member', {
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

            console.log(`STREAM ENDED => ${username}`);

            connections.delete(username);

            io.emit('streamEnd', {
                username
            });

        });

        res.json({
            success: true,
            username,
            message: 'connected'
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

});


// =========================
// DISCONNECT
// =========================

app.get('/disconnect', async (req, res) => {

    const username = req.query.user;

    if (!connections.has(username)) {

        return res.json({
            success: false,
            message: 'not connected'
        });

    }

    try {

        const connection = connections.get(username);

        await connection.disconnect();

        connections.delete(username);

        res.json({
            success: true,
            username,
            message: 'disconnected'
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

});


// =========================
// SOCKET.IO
// =========================

io.on('connection', socket => {

    console.log('Browser connected');

    socket.emit('welcome', {
        message: 'Connected to server'
    });

    socket.on('disconnect', () => {
        console.log('Browser disconnected');
    });

});


// =========================
// START SERVER
// =========================

server.listen(process.env.PORT || 3001, () => {

    console.log(
        `SERVER RUNNING PORT ${process.env.PORT || 3001}`
    );

});
