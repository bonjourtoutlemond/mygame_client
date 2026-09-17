# MMORPG Client Workspace

This directory owns client-facing code for the MMORPG demos.

## Layout

- `native/`: command-line/native client entry points. `plain_json_client.cpp` is the shared protocol client; `ace_windows_client.cpp` is the legacy ACE Windows GUI client used by demo1/demo2.
- `web/`: browser client UI. It is responsive and is the starting point for the mobile web game.
- `eat/`: mobile-browser turntable game client. It talks to `server/eat-turntable`
  over HTTP JSON APIs and is the current recommended base for the next mobile
  web mini-game.
- `gateway/`: WebSocket-to-game TCP gateway used by browsers and mobile web.
- `scripts/`: launchers for local development.
- `protocol/`: client/server protocol notes shared by Windows, web, app, and mobile web clients.

## Runtime Model

Native desktop clients can connect to `game_server` directly over TCP. Browser
clients cannot open raw TCP sockets, so they connect to `gateway/web_gateway.js`
with WebSocket. The gateway forwards newline-delimited JSON commands to the
selected `game_server` player port.

Clients should treat `dbcache_server` and `inter_server` as private server-side
services. Public clients only talk to the game entry point:

- Windows client: TCP `game_server` player port.
- Web client: WebSocket gateway, then TCP `game_server`.
- Mobile app: TCP or WebSocket gateway, depending on deployment.
- Mobile web: WebSocket gateway.

## Start Web Client

```powershell
cd E:\ace
.\client\scripts\start_web_client.ps1
```

Open:

```text
http://127.0.0.1:8088
```

The demo servers must already be running. If Redis/dbcache is offline, login and
player-list commands will return server errors.
