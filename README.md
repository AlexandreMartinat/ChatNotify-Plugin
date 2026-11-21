# Chat Notify Plugin for [FM-DX-Webserver](https://github.com/NoobishSVK/fm-dx-webserver)

Get every chat message of your FM-DX Webserver as a **push notification on your phone**, through [ntfy](https://ntfy.sh).

## Features

- 📱 **Push notifications** for every chat message, with the sender's nickname (`[admin]` prefix for admins)
- 🧩 **No change to FM-DX itself**: the plugin listens to the chat like an invisible visitor, so FM-DX updates never break it
- 🛡️ **Works with chat filters**: messages blocked by a filter plugin such as [Chat Filter](https://github.com/konsvlac1/fmdx-plugins) are never published, so they never reach your phone
- 🌊 **Flood guard**: at most `maxPerMinute` notifications per minute; extra messages are summed up in one notification
- 📅 **Daily budget**: at most `maxPerDay` notifications per rolling 24 h (kept across restarts), then one "budget reached" notice. On ntfy.sh without an account each IP may publish 250 messages a day, so a chat flood can no longer use up the quota needed by your other alerts (transmitter, monitoring…) sent from the same IP
- 🔐 **Private topics**: optional ntfy access token, or your own self-hosted ntfy server
- 🔁 **Auto-reconnect** after a restart or a network hiccup

## Requirements

- **fm-dx-webserver v1.4.0+**, with the chat enabled
- The [ntfy app](https://ntfy.sh) (Android / iOS) or the ntfy web app

## Installation

1. Copy `ChatNotify.js` and the `ChatNotify/` folder into your `plugins/` directory
2. Copy `plugins_configs/chatnotify.json` into your `plugins_configs/` directory
3. **Set your `topic`** in `plugins_configs/chatnotify.json`
4. Add `"ChatNotify/chatnotify.js"` to the `plugins` array in your `config.json` (or tick **Chat Notify** in Setup → Plugins)
5. Restart the server
6. In the ntfy app, subscribe to the same topic

## Configuration

`plugins_configs/chatnotify.json` is read at startup: restart the server after changing it.

| Key | Default | Meaning |
|-----|---------|---------|
| `enabled` | `true` | Turn the plugin on or off |
| `server` | `https://ntfy.sh` | ntfy server URL (public or self-hosted) |
| `topic` | (none) | **Required.** The ntfy topic to publish to |
| `token` | `""` | Optional ntfy access token (`tk_...`) for protected topics |
| `title` | `FM-DX Chat` | Notification title (for example, add your site name) |
| `priority` | `3` | ntfy priority, from 1 (min) to 5 (max) |
| `tags` | `radio` | Comma-separated ntfy tags or emojis |
| `ignoreAdmins` | `false` | `true` to skip messages sent by a logged-in admin |
| `maxPerMinute` | `10` | Flood guard: notifications allowed per minute |
| `maxPerDay` | `100` | Daily budget: notifications allowed per rolling 24 h |

> ⚠️ **Topics on ntfy.sh are public**: anyone who knows or guesses the name can read your chat and post to it. Use a long random name (for example `fmdx-chat-7f3k9q2xw8`), or a protected topic with a token.

## How It Works

On startup the plugin opens a WebSocket to the server's own `/chat` endpoint on `127.0.0.1`. It ignores the chat history replayed on connect and internal messages, and publishes each new chat message with the ntfy JSON API (UTF-8 safe titles and emojis). It never sends anything to the chat.

## Changelog

- **v1.1**: Daily budget (`maxPerDay`), saved in `plugins_configs/chatnotify-state.json`.
- **v1.0**: Initial release.

## License

MIT License: free to use, modify, and distribute.
