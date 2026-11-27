import { connect } from 'cloudflare:sockets';

const MCSRVSTAT_API = 'https://api.mcsrvstat.us/simple/';
const MCSTATUS_API = 'https://api.mcstatus.io/v2/status/java/';
const DNS_API = 'https://cloudflare-dns.com/dns-query';
const DISCORD_API = 'https://discord.com/api/v10';

function encodeServerAddress(address) {
  const match = address.match(/^(.+):(\d+)$/);
  return match
    ? encodeURIComponent(match[1]) + ':' + match[2]
    : encodeURIComponent(address);
}

async function resolveServerAddress(address) {
  const explicit = address.match(/^(.+):(\d+)$/);
  if (explicit) return { address, source: 'configured-port' };

  const srvName = '_minecraft._tcp.' + address.replace(/\.$/, '');
  const url = DNS_API + '?name=' + encodeURIComponent(srvName) + '&type=SRV';
  const response = await fetch(url, {
    headers: {
      Accept: 'application/dns-json',
      'User-Agent': 'ArcamisBot/1.0 (Minecraft server status monitor)',
    },
  });
  if (!response.ok) throw new Error('DNS SRV API HTTP ' + response.status);

  const data = await response.json();
  const records = (data.Answer || [])
    .filter((answer) => answer.type === 33)
    .map((answer) => {
      const match = String(answer.data || '').match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.+?)\.?$/);
      return match
        ? {
            priority: Number(match[1]),
            weight: Number(match[2]),
            port: Number(match[3]),
            target: match[4].replace(/\.$/, ''),
          }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.priority - b.priority || b.weight - a.weight);

  if (!records.length) return { address, source: 'hostname-no-srv' };
  const record = records[0];
  if (record.target === '.') throw new Error('Il record SRV indica che il servizio Minecraft non è disponibile');

  return {
    address: record.target + ':' + record.port,
    source: 'srv',
    target: record.target,
    port: record.port,
    priority: record.priority,
  };
}


function encodeVarInt(value) {
  const bytes = [];
  let remaining = value >>> 0;
  while ((remaining & 0xffffff80) !== 0) {
    bytes.push((remaining & 0x7f) | 0x80);
    remaining >>>= 7;
  }
  bytes.push(remaining & 0x7f);
  return Uint8Array.from(bytes);
}

function readVarInt(bytes, offset) {
  let value = 0;
  let length = 0;
  while (length < 5) {
    if (offset + length >= bytes.length) return null;
    const byte = bytes[offset + length];
    value |= (byte & 0x7f) << (7 * length);
    length += 1;
    if ((byte & 0x80) === 0) return { value: value >>> 0, length };
  }
  throw new Error('VarInt Minecraft non valido');
}

function joinBytes(parts) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function framePacket(payload) {
  return joinBytes([encodeVarInt(payload.length), payload]);
}

async function readWithTimeout(reader, timeoutMs = 5000) {
  let timeoutId;
  try {
    return await Promise.race([
      reader.read(),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Timeout ping Minecraft')), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function pingMinecraftServer(address, handshakeAddress = address) {
  const match = address.match(/^(.+):(\d+)$/);
  if (!match) throw new Error('Indirizzo Minecraft senza porta: ' + address);

  const hostname = match[1];
  const port = Number(match[2]);
  const encoder = new TextEncoder();
  const handshakeHostname = handshakeAddress.includes(':') ? handshakeAddress.slice(0, handshakeAddress.lastIndexOf(':')) : handshakeAddress;
  const hostBytes = encoder.encode(handshakeHostname);
  const hostLength = encodeVarInt(hostBytes.length);
  const portBytes = new Uint8Array([port >>> 8, port & 0xff]);
  const handshake = framePacket(joinBytes([
    encodeVarInt(0),
    encodeVarInt(767),
    hostLength,
    hostBytes,
    portBytes,
    encodeVarInt(1),
  ]));
  const statusRequest = Uint8Array.from([1, 0]);

  const socket = connect({ hostname, port }, { allowHalfOpen: true });
  let reader;
  let writer;
  try {
    await socket.opened;
    reader = socket.readable.getReader();
    writer = socket.writable.getWriter();
    await writer.write(joinBytes([handshake, statusRequest]));
    writer.releaseLock();
    writer = null;

    let received = new Uint8Array();
    while (received.length < 131072) {
      const chunkResult = await readWithTimeout(reader);
      if (chunkResult.done) throw new Error('Il server ha chiuso la connessione durante il ping');
      received = joinBytes([received, chunkResult.value]);

      const packetLength = readVarInt(received, 0);
      if (!packetLength) continue;
      const packetStart = packetLength.length;
      if (received.length < packetStart + packetLength.value) continue;

      const packetId = readVarInt(received, packetStart);
      if (!packetId || packetId.value !== 0) {
        throw new Error('Risposta status Minecraft non valida');
      }
      const stringLength = readVarInt(received, packetStart + packetId.length);
      if (!stringLength) throw new Error('Risposta status Minecraft incompleta');
      const jsonStart = packetStart + packetId.length + stringLength.length;
      const jsonEnd = jsonStart + stringLength.value;
      if (received.length < jsonEnd) continue;

      const status = JSON.parse(new TextDecoder().decode(received.slice(jsonStart, jsonEnd)));
      const version = status.version?.name || null;
      // Aternos may answer on its fallback port while the actual server is stopped,
      // advertising a proxy status named "● Offline". A TCP response alone is not
      // enough to consider that server online.
      const normalizedVersion = String(version || '')
        .replace(/§[0-9a-fk-or]/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
      const online = !normalizedVersion.includes('● offline');
      return {
        source: 'minecraft-tcp',
        online,
        version,
        players: status.players?.online ?? null,
        maxPlayers: status.players?.max ?? null,
        playerNames: Array.isArray(status.players?.sample)
          ? status.players.sample
              .map((player) =>
                typeof player?.name === 'string'
                  ? player.name
                  : typeof player === 'string'
                    ? player
                    : null
              )
              .filter(Boolean)
          : [],
      };
    }
    throw new Error('Risposta status Minecraft troppo grande');
  } finally {
    try { reader?.releaseLock(); } catch {}
    try { writer?.releaseLock(); } catch {}
    try { await socket.close(); } catch {}
  }
}

async function pingMinecraftServerWithRetry(address, handshakeAddress) {
  try {
    return await pingMinecraftServer(address, handshakeAddress);
  } catch (firstError) {
    console.warn('Ping Minecraft fallito; riprovo una volta:', firstError?.message || firstError);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return pingMinecraftServer(address, handshakeAddress);
  }
}

async function discordRequest(path, token, options = {}) {
  const response = await fetch(DISCORD_API + path, {
    ...options,
    headers: {
      Authorization: 'Bot ' + token,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error('Discord API ' + response.status + ': ' + detail);
  }

  return response.status === 204 ? null : response.json();
}

/**
 * Polls the Java server and publishes state changes in the configured Discord channel.
 * The channel topic keeps the last state, so no database migration is needed.
 */
export async function aggiornaStatoMinecraft(env) {
  const address = env.MINECRAFT_SERVER_ADDRESS?.trim();
  const channelId = env.MINECRAFT_STATUS_CHANNEL_ID?.trim();
  const token = env.DISCORD_TOKEN;

  if (!address || !channelId || !token) {
    throw new Error(
      'Configura MINECRAFT_SERVER_ADDRESS, MINECRAFT_STATUS_CHANNEL_ID e il secret DISCORD_TOKEN'
    );
  }

  const resolved = await resolveServerAddress(address);
  const serverAddress = encodeServerAddress(resolved.address);
  console.info('Minecraft server address resolved:', resolved);

  const statusChecks = await Promise.allSettled([
    pingMinecraftServerWithRetry(resolved.address, address),
    fetch(MCSRVSTAT_API + serverAddress, {
      headers: {
        Accept: 'text/plain',
        'User-Agent': 'ArcamisBot/1.0 (Minecraft server status monitor)',
      },
    }).then((response) => {
      if (response.status === 200) return { source: 'mcsrvstat.us', online: true };
      if (response.status === 404) return { source: 'mcsrvstat.us', online: false };
      throw new Error('HTTP ' + response.status);
    }),
    fetch(
      MCSTATUS_API + serverAddress + '?query=false&timeout=5',
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'ArcamisBot/1.0 (Minecraft server status monitor)',
        },
      }
    ).then(async (response) => {
      if (!response.ok) {
        throw new Error('HTTP ' + response.status + ': ' + (await response.text()));
      }
      const data = await response.json();
      if (typeof data.online !== 'boolean') {
        throw new Error('La risposta di mcstatus.io non contiene online');
      }
      return { source: 'mcstatus.io', online: data.online };
    }),
  ]);

  const successfulChecks = statusChecks
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);
  const failedChecks = statusChecks
    .filter((result) => result.status === 'rejected')
    .map((result) => String(result.reason?.message || result.reason));

  console.info('Minecraft status providers:', {
    address: resolved.address,
    successful: successfulChecks,
    failed: failedChecks,
  });

  // Aternos advertises its active dynamic port through SRV. The default
  // port can answer with a proxy "Offline" MOTD, while the active dynamic port
  // may occasionally fail a status ping even as players are connected.
  const tcpCheck = statusChecks[0];
  const hasActiveAternosPort =
    resolved.source === 'srv' && resolved.port !== 25565;
  const online =
    tcpCheck.status === 'fulfilled'
      ? tcpCheck.value.online
      : hasActiveAternosPort;

  const channelPath = '/channels/' + encodeURIComponent(channelId);
  const channel = await discordRequest(channelPath, token);
  const currentTopic = channel.topic || '';
  const topicLines = currentTopic.split('\n');
  const previousMarker = topicLines[0].match(/^Minecraft server: (ONLINE|OFFLINE)$/);
  const previousState = previousMarker ? previousMarker[1] : null;
  const oldDescription = previousMarker ? topicLines.slice(1).join('\n') : currentTopic;
  const state = online ? 'ONLINE' : 'OFFLINE';
  const statusLine = 'Minecraft server: ' + state;
  const newTopic = [statusLine, oldDescription]
    .filter(Boolean)
    .join('\n')
    .slice(0, 1024);

  const stateChanged = previousState !== state;
  console.info('Minecraft Discord state:', {
    previousState,
    state,
    topicMarkerFound: Boolean(previousMarker),
  });

  const checkedAt = Math.floor(Date.now() / 1000);
  const pingStatus = tcpCheck.status === 'fulfilled' ? tcpCheck.value : null;
  const playerCount = pingStatus?.online ? pingStatus.players : online ? null : 0;
  const maxPlayerCount = pingStatus?.online ? pingStatus.maxPlayers : null;
  const playerNames = pingStatus?.online ? pingStatus.playerNames : [];
  const serverVersion = pingStatus?.online ? pingStatus.version : null;
  let playerNamesText;
  if (!online || playerCount === 0) {
    playerNamesText = 'Nessuno al momento';
  } else if (playerNames.length) {
    const shownNames = playerNames.slice(0, 12);
    playerNamesText = shownNames.map((name) => '• ' + name).join('\\n');
    if (playerNames.length > shownNames.length) {
      playerNamesText += '\\n… e altri ' + (playerNames.length - shownNames.length);
    }
  } else {
    playerNamesText = 'Il server non comunica i nomi.';
  }
  const embed = {
    author: { name: 'ARCAMIS • MONITOR MINECRAFT' },
    title: '⛏️ Stato del server',
    description: online
      ? '🟢 **ONLINE**\nIl server è attivo e raggiungibile.'
      : '🔴 **OFFLINE**\nIl server non risponde al controllo.',
    color: online ? 0x2ecc71 : 0xe74c3c,
    fields: [
      {
        name: '🌐 Indirizzo',
        value: '`mndlm.aternos.me`',
        inline: true,
      },
      {
        name: '👥 Giocatori',
        value:
          playerCount === null
            ? '—'
            : maxPlayerCount === null
              ? String(playerCount) + ' online'
              : playerCount + ' / ' + maxPlayerCount,
        inline: true,
      },
      {
        name: '👤 Nomi disponibili',
        value: playerNamesText.slice(0, 1024),
        inline: true,
      },
      ...(serverVersion
        ? [{ name: '⚙️ Versione', value: serverVersion.slice(0, 1024), inline: true }]
        : []),
      {
        name: '🕓 Ultimo controllo',
        value: '<t:' + checkedAt + ':R>',
        inline: false,
      },
    ],
    footer: { text: 'ARCAMIS  •  aggiornamento automatico ogni 5 minuti' },
    timestamp: new Date().toISOString(),
  };
  const messagePayload = {
    content: '',
    embeds: [embed],
    allowed_mentions: { parse: [] },
  };

  const storedMessage = await env.DB.prepare(
    'SELECT message_id FROM minecraft_status_messages WHERE channel_id = ?'
  )
    .bind(channelId)
    .first();

  let statusMessageId = storedMessage?.message_id || null;

  if (statusMessageId) {
    try {
      await discordRequest(
        channelPath + '/messages/' + encodeURIComponent(statusMessageId),
        token,
        {
          method: 'PATCH',
          body: JSON.stringify(messagePayload),
        }
      );
      console.info('Minecraft Discord status embed updated:', {
        state,
        messageId: statusMessageId,
        stateChanged,
      });
    } catch (error) {
      if (!String(error?.message || error).startsWith('Discord API 404:')) {
        throw error;
      }
      console.warn('Stored Minecraft status message no longer exists; searching for an older one.');
      statusMessageId = null;
    }
  }

  if (!statusMessageId) {
    const recentMessages = await discordRequest(channelPath + '/messages?limit=100', token);
    const existingStatusMessage = recentMessages.find(
      (message) =>
        message.author?.bot &&
        (
          /^🟢 Il server Minecraft è \*\*ONLINE\*\*\.|^🔴 Il server Minecraft è \*\*OFFLINE\*\*\./.test(
            message.content || ''
          ) ||
          message.embeds?.some((item) => item.title === '⛏️ Stato del server')
        )
    );

    if (existingStatusMessage) {
      statusMessageId = existingStatusMessage.id;
      await discordRequest(
        channelPath + '/messages/' + encodeURIComponent(statusMessageId),
        token,
        {
          method: 'PATCH',
          body: JSON.stringify(messagePayload),
        }
      );
      console.info('Minecraft Discord status message recovered and updated:', {
        state,
        messageId: statusMessageId,
      });
    } else {
      const createdMessage = await discordRequest(channelPath + '/messages', token, {
        method: 'POST',
        body: JSON.stringify(messagePayload),
      });
      statusMessageId = createdMessage.id;
      console.info('Minecraft Discord fixed status embed created:', {
        state,
        messageId: statusMessageId,
      });
    }

    await env.DB.prepare(
      'INSERT INTO minecraft_status_messages (channel_id, message_id) ' +
        'VALUES (?, ?) ' +
        'ON CONFLICT(channel_id) DO UPDATE SET ' +
        'message_id = excluded.message_id, updated_at = CURRENT_TIMESTAMP'
    )
      .bind(channelId, statusMessageId)
      .run();
  }

  await discordRequest(
    channelPath + '/pins/' + encodeURIComponent(statusMessageId),
    token,
    { method: 'PUT' }
  );
  console.info('Minecraft Discord status message pinned:', {
    messageId: statusMessageId,
  });

  if (newTopic !== currentTopic) {
    await discordRequest(channelPath, token, {
      method: 'PATCH',
      body: JSON.stringify({ topic: newTopic }),
    });
    console.info('Minecraft Discord channel topic updated:', { state });
  }
}
