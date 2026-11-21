//////////////////////////////////////////////////////////////////////////////
///                                                                        ///
///  CHAT NOTIFY SERVER PLUGIN FOR FM-DX-WEBSERVER (V1.0)                  ///
///                                                                        ///
///  Sends every published chat message to an ntfy topic (push to phone).  ///
///  It listens to the chat like an invisible visitor: no change to        ///
///  FM-DX itself, so it survives FM-DX updates. Messages blocked by a     ///
///  chat filter plugin (e.g. Chat Filter) are never published, so they    ///
///  never reach ntfy either.                                              ///
///                                                                        ///
///  Settings: plugins_configs/chatnotify.json (read at startup).          ///
///                                                                        ///
//////////////////////////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const { serverConfig } = require('../../server/server_config');
const { logInfo, logWarn, logError } = require('../../server/console');

const TAG = '[Chat Notify]';
const CONFIG_PATH = path.resolve(__dirname, '../../plugins_configs/chatnotify.json');
const DEFAULT_CONFIG = {
    enabled: true,
    server: 'https://ntfy.sh',   // or your own ntfy server
    topic: '',                    // REQUIRED. Use a long random name: anyone who knows it can read it
    token: '',                    // optional access token (ntfy "tk_..."), for protected topics
    title: 'FM-DX Chat',
    priority: 3,                  // 1 (min) .. 5 (max)
    tags: 'radio',
    ignoreAdmins: false,          // true: do not notify messages sent by a logged-in admin
    maxPerMinute: 10              // flood guard: extra messages are summarised in one notification
};

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            return Object.assign({}, DEFAULT_CONFIG, JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')));
        }
        fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
        logInfo(`${TAG} Default config created at ${CONFIG_PATH} — set "topic" and restart.`);
    } catch (e) {
        logError(`${TAG} Cannot read ${CONFIG_PATH}: ${e.message}`);
    }
    return Object.assign({}, DEFAULT_CONFIG);
}

const config = loadConfig();

// ─── ntfy publishing (JSON API: UTF-8 safe for title and message) ───────────

function decodeEntities(s) {
    return String(s || '')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/&#0?39;/g, "'").replace(/&amp;/g, '&');
}

function publish(message) {
    let url;
    try { url = new URL(config.server); } catch (e) { logError(`${TAG} Invalid server URL: ${config.server}`); return; }
    const body = JSON.stringify({
        topic: config.topic,
        title: config.title,
        message,
        priority: Number(config.priority) || 3,
        tags: String(config.tags || '').split(',').map(t => t.trim()).filter(Boolean)
    });
    const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) };
    if (config.token) headers.Authorization = `Bearer ${config.token}`;

    const lib = url.protocol === 'http:' ? http : https;
    const req = lib.request({
        hostname: url.hostname,
        port: url.port || undefined,
        path: url.pathname.replace(/\/+$/, '') || '/',
        method: 'POST',
        headers,
        timeout: 10000
    }, (res) => {
        if (res.statusCode >= 300) logWarn(`${TAG} ntfy answered HTTP ${res.statusCode}`);
        res.resume();
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => logWarn(`${TAG} ntfy error: ${e.message}`));
    req.end(body);
}

// ─── Flood guard ────────────────────────────────────────────────────────────

let sentTimes = [];
let dropped = 0;

function notify(text) {
    const now = Date.now();
    sentTimes = sentTimes.filter(t => now - t < 60000);
    if (sentTimes.length >= config.maxPerMinute) { dropped++; return; }
    sentTimes.push(now);
    publish(text);
}

setInterval(() => {
    if (!dropped) return;
    publish(`… and ${dropped} more chat message(s) in the last minute (flood guard).`);
    logWarn(`${TAG} Flood guard: ${dropped} message(s) not notified`);
    dropped = 0;
}, 60000).unref();

// ─── Invisible chat listener ────────────────────────────────────────────────

const port = (serverConfig.webserver && serverConfig.webserver.webserverPort) || 8080;
const CHAT_URL = `ws://127.0.0.1:${port}/chat`;
let socket = null;
let retryMs = 5000;

function connect() {
    if (serverConfig.webserver && serverConfig.webserver.chatEnabled === false) {
        setTimeout(connect, 60000);   // chat switched off: check again later
        return;
    }
    socket = new WebSocket(CHAT_URL);

    socket.on('open', () => {
        retryMs = 5000;
        logInfo(`${TAG} Listening to the chat, notifications to ${config.server.replace(/\/+$/, '')}/${config.topic}`);
    });

    socket.on('message', (raw) => {
        let m;
        try { m = JSON.parse(raw.toString()); } catch (e) { return; }
        if (!m || m.history || m.type || m.id === -1) return;          // history, clientIp info, filter notices
        if (typeof m.message !== 'string' || !m.message.trim()) return;
        if (config.ignoreAdmins && m.admin) return;
        const who = decodeEntities(m.nickname) || 'Anonymous';
        notify(`${m.admin ? '[admin] ' : ''}${who}: ${decodeEntities(m.message)}`);
    });

    socket.on('close', () => {
        setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, 60000);
    });

    socket.on('error', () => { /* 'close' follows and schedules the retry */ });
}

if (!config.enabled) {
    logInfo(`${TAG} Disabled in ${CONFIG_PATH}`);
} else if (!config.topic) {
    logWarn(`${TAG} No "topic" set in ${CONFIG_PATH}: nothing will be sent.`);
} else {
    setTimeout(connect, 3000);   // let the web server finish starting
    logInfo(`${TAG} Server plugin initialized (v1.0)`);
}
