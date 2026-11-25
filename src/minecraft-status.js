const MCSRVSTAT_API = 'https://api.mcsrvstat.us/simple/';
const MCSTATUS_API = 'https://api.mcstatus.io/v2/status/java/';
const DISCORD_API = 'https://discord.com/api/v10';

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

  const statusChecks = await Promise.allSettled([
    fetch(MCSRVSTAT_API + encodeURIComponent(address), {
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
      MCSTATUS_API + encodeURIComponent(address) + '?query=false&timeout=5',
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
    successful: successfulChecks,
    failed: failedChecks,
  });

  // A single failed or stale source must not mark a reachable server offline.
  const online = successfulChecks.some((result) => result.online);
  if (!online && successfulChecks.length < 2) {
    throw new Error('Risposta stato incompleta: ' + failedChecks.join('; '));
  }

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

  // The channel name is deliberately left untouched; status is shown in its topic.
  if (newTopic !== currentTopic) {
    await discordRequest(channelPath, token, {
      method: 'PATCH',
      body: JSON.stringify({ topic: newTopic }),
    });
  }

  if (previousState === state) return;

  const checkedAt = Math.floor(Date.now() / 1000);
  const content = [
    online
      ? '🟢 Il server Minecraft è **ONLINE**.'
      : '🔴 Il server Minecraft è **OFFLINE**.',
    'Ultimo controllo: <t:' + checkedAt + ':R>',
  ].join('\n');

  await discordRequest('/channels/' + encodeURIComponent(channelId) + '/messages', token, {
    method: 'POST',
    body: JSON.stringify({
      content,
      allowed_mentions: { parse: [] },
    }),
  });
}
