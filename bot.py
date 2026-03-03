import discord
from discord.ext import commands
import json
import os
import time

# Carica dati dal file JSON
DATA_FILE = "caminetto.json"
CONSUMO = 4320  # secondi (1h12m)
MAX_WOOD = 5

def load_data():
    if not os.path.exists(DATA_FILE):
        return {}
    with open(DATA_FILE, "r") as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)

def get_channel_fire(channel_id):
    data = load_data()
    now = int(time.time())
    key = str(channel_id)

    if key not in data:
        data[key] = {"wood": 0, "last_update": now}
        save_data(data)
        return 0, now, 0

    wood = int(data[key]["wood"])
    last_update = int(data[key]["last_update"])
    elapsed = now - last_update
    consumed = elapsed // CONSUMO
    wood = max(0, wood - consumed)

    data[key]["wood"] = wood
    data[key]["last_update"] = now
    save_data(data)

    return wood, now, elapsed

def get_countdown(wood, elapsed):
    CONSUMO = 4320
    secondi_al_prossimo = CONSUMO - (elapsed % CONSUMO)
    secondi_totali = secondi_al_prossimo + (wood - 1) * CONSUMO
    ore = secondi_totali // 3600
    minuti = (secondi_totali % 3600) // 60
    sec = secondi_totali % 60
    if ore > 0:
        return f"⏳ Caminetto spento tra: **{ore}h {minuti}m {sec}s**"
    else:
        return f"⏳ Caminetto spento tra: **{minuti}m {sec}s**"

# Setup bot
intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="!", intents=intents, help_command=None)

@bot.event
async def on_ready():
    print(f"✅ Bot connesso come {bot.user}")

@bot.command(name="caminetto")
async def caminetto(ctx, azione: str = None, quantita: int = 1):
    channel_id = str(ctx.channel.id)
    now = int(time.time())

    # --- STATO ---
    if azione is None:
        wood, _, elapsed = get_channel_fire(channel_id)

        if wood == 0:
            embed = discord.Embed(
                title="❄️ Caminetto",
                description="Il caminetto è **spento**.\n🪵 Aggiungi legna con `!caminetto aggiungi`!",
                color=0x4444ff
            )
        else:
            countdown = get_countdown(wood, elapsed)
            if wood == 1:
                fiamma = "🔥 Caminetto"
                colore = 0xff6600
            elif wood <= 3:
                fiamma = "🔥🔥 Caminetto"
                colore = 0xff4400
            else:
                fiamma = "🔥🔥🔥 Caminetto"
                colore = 0xff2200

            embed = discord.Embed(
                title=fiamma,
                description=f"Legna rimasta: **{wood}/{MAX_WOOD}**\n{countdown}",
                color=colore
            )

        embed.set_footer(text="Usa !caminetto aggiungi [n] per aggiungere legna (max 5).")
        await ctx.send(embed=embed)

    # --- AGGIUNGI ---
    elif azione.lower() == "aggiungi":
        wood, _, elapsed = get_channel_fire(channel_id)

        if quantita < 1:
            quantita = 1

        spazio = MAX_WOOD - wood
        if spazio <= 0:
            embed = discord.Embed(
                title="🔥 Caminetto",
                description="❌ Il caminetto è già **pieno**! Ci sono già 5 pezzi di legna.",
                color=0xff6600
            )
        else:
            aggiunti = min(quantita, spazio)
            wood += aggiunti

            data = load_data()
            data[channel_id] = {"wood": wood, "last_update": now}
            save_data(data)

            countdown = get_countdown(wood, elapsed)
            extra = f"\n*(solo {aggiunti} pezzi erano necessari per riempirlo)*" if aggiunti < quantita else ""

            embed = discord.Embed(
                title="🔥 Caminetto",
                description=f"🪵 **{ctx.author.display_name}** aggiunge **{aggiunti}** pezzo/i di legna!\n🔥 Legna totale: **{wood}/{MAX_WOOD}**\n{countdown}{extra}",
                color=0xff6600
            )

        embed.set_footer(text="Usa !caminetto aggiungi [n] per aggiungere legna (max 5).")
        await ctx.send(embed=embed)

    # --- RESET ---
    elif azione.lower() == "reset":
        # Solo chi ha il ruolo DM o è admin può resettare
        if not ctx.author.guild_permissions.administrator:
            await ctx.send("❌ Solo un amministratore può resettare il caminetto.")
            return

        data = load_data()
        data[channel_id] = {"wood": 0, "last_update": now}
        save_data(data)

        embed = discord.Embed(
            title="🔥 Caminetto",
            description="Il caminetto è stato **spento e resettato**.",
            color=0x888888
        )
        await ctx.send(embed=embed)

    else:
        embed = discord.Embed(
            title="❓ Caminetto",
            description="Comandi disponibili:\n`!caminetto` — stato\n`!caminetto aggiungi [n]` — aggiungi legna\n`!caminetto reset` — resetta (solo admin)",
            color=0x888888
        )
        await ctx.send(embed=embed)

bot.run(os.environ["DISCORD_TOKEN"])
