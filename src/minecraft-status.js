const STATUS_API = 'https://api.mcsrvstat.us/simple/';
const DISCORD_API = 'https://discord.com/api/v10';

async function discordRequest(path, token, options = {}) {
  const response = await fetch(`${DISCORD_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Discord API ${response.status}: ${detail}`);
  }

  return response.status === 204 ? null : response.json();
}

/**
 * Polls the Java server and reflects its state in the configured Discord channel.
 * The channel name doubles as persisted state, so no database migration is needed.
 */
export async function aggiornaStatoMinecraft(env) {
  const address = env.MINECRAFT_SERVER_ADDRESS?.trim();
  const channelId = env.MINECRAFT_STATUS_CHANNEL_ID?.trim();
  const token = env.DISCORD_BOT_TOKEN;

  if (!address || !channelId || !token) {
    throw new Error(
      'Configura MINECRAFT_SERVER_ADDRESS, MINECRAFT_STATUS_CHANNEL_ID e il secret DISCORD_BOT_TOKEN'
    );
  }

  const statusResponse = await fetch(
    `${STATUS_API}${encodeURIComponent(address)}`,
    { headers: { Accept: 'application/json' } }
  );

  let online;
  if (statusResponse.status === 200) {
    online = true;
  } else if (statusResponse.status === 404) {
    online = false;
  } else {
    throw new Error(`Minecraft status API ${statusResponse.status}`);
  }

  const channelPath = `/channels/${encodeURIComponent(channelId)}`;
  const channel = await discordRequest(channelPath, token);
  const targetName = online ? 'minecraft-online' : 'minecraft-offline';

  // Do not hit Discord's channel-update rate limit when the state is unchanged.
  if (channel.name === targetName) return;

  await discordRequest(channelPath, token, {
    method: 'PATCH',
    body: JSON.stringify({ name: targetName }),
  });

  const checkedAt = Math.floor(Date.now() / 1000);
  const content = online
    ? `🟢 Il server Minecraft è **ONLINE**.\\nUltimo controllo: <t:${checkedAt}:R>`
    : `🔴 Il server Minecraft è **OFFLINE**.\\nUltimo controllo: <t:${checkedAt}:R>`;

  await discordRequest(`/channels/${encodeURIComponent(channelId)}/messages`, token, {
    method: 'POST',
    body: JSON.stringify({
      content,
      allowed_mentions: { parse: [] },
    }),
  });
}
