# MMORPG Client Protocol

Protocol version: `1`

The public client protocol is newline-delimited JSON over a reliable stream.
Desktop clients may send the JSON lines directly over TCP. Web and mobile-web
clients send the same JSON objects over WebSocket to the gateway; the gateway
forwards them as TCP JSON lines to `game_server`.

## Envelope

Every new client should include these optional envelope fields:

```json
{
  "version": 1,
  "client": "mobile-web",
  "transport": "websocket",
  "cmd": "login"
}
```

Known `client` values:

- `windows`
- `web`
- `mobile-app`
- `mobile-web`

Known `transport` values:

- `tcp`
- `websocket`

The server accepts missing envelope fields as version `1` for older tooling. It
rejects future versions greater than the server-supported version.

## Commands

Login:

```json
{"version":1,"client":"mobile-web","transport":"websocket","cmd":"login","name":"alice"}
```

List players:

```json
{"version":1,"client":"mobile-web","transport":"websocket","cmd":"list_players","offset":0,"limit":12}
```

Add friend:

```json
{"version":1,"client":"mobile-web","transport":"websocket","cmd":"friend_add","target":"bob"}
```

List friends:

```json
{"version":1,"client":"mobile-web","transport":"websocket","cmd":"friend_list"}
```

Send chat:

```json
{"version":1,"client":"mobile-web","transport":"websocket","cmd":"say","target":"bob","message":"hello"}
```

Add EXP:

```json
{"version":1,"client":"mobile-web","transport":"websocket","cmd":"exp","amount":10}
```

Quit:

```json
{"version":1,"client":"mobile-web","transport":"websocket","cmd":"quit"}
```

## Events

All JSON responses include `type`, `version`, and usually `ok`.

```json
{"type":"login","version":1,"ok":true,"name":"alice","level":1,"exp":0,"game":"game1","client":"mobile-web","transport":"websocket"}
```

```json
{"type":"player_list","version":1,"ok":true,"offset":0,"players":[{"name":"alice","level":1}]}
```

```json
{"type":"chat","version":1,"from":"bob","message":"hello"}
```

```json
{"type":"error","version":1,"ok":false,"message":"dbcache offline"}
```

## Mobile Web Notes

The mobile web game should keep all gameplay commands behind this JSON envelope
instead of calling server internals. When realtime movement or battle actions are
added, add new `cmd` names under version `1` only if they are backward-compatible.
If message shape changes incompatibly, bump the version and keep the gateway able
to route older clients during transition.
