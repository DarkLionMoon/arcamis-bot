import discord
from discord.ext import commands
import os
import time
from supabase import create_client, Client

# Supabase
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

CONSUMO = 4320  # secondi (1h12m)
MAX_WOOD = 5

def get_channel_data(channel_id: str):
    now = int(time.time())
    result = supabase.table("caminetto").select("*").eq("channel_id", channel_id).execute()

    if not result.data:
        supabase.table("caminetto").insert({
            "channel_id": channel_id,
            "wood": 0,
            "last_update": now
        }).execute()
        return 0, now, 0

    row = result.data[0]
    wood = int(row["wood"])
    last_update = int(row["last_update"])
    elapsed = now - last_update
    consumed = elapsed // CONSUMO
    wood = max(0, wood - consumed)

    supabase.table("caminetto").update({
        "wood": wood,
        "last_update": now
    }).eq("channel_id", channel_id).execute()

    return wood, now, elapsed

def set_channel_wood(channel_id: str, wood: int):
    now = int(time.time())
    supabase.table("caminetto").update({
        "wood": wood,
        "last_update": now
    }).eq("channel_id", channel_id).execute()

def get_countdown(wood, elapsed):
    secondi_al_prossimo = CONSUMO - (elapsed % CONSUMO)
    secondi_totali = secondi_al_prossimo + (wood - 1) * CONSUMO
    ore = secondi_totali // 3600
    minuti = (secondi_totali % 3600) // 60
    sec = secondi_totali % 60
    if ore > 0:
        return f"⏳ Caminetto spento tra: **{ore}h {minuti}m {sec}s**"
    else:
        return f"⏳ Caminetto spento tra: **{minuti}m {sec}s**"

intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="!", intents=intents, help_command=None)

@bot.event
async def on_ready():
    print(f"✅ Bot connesso come {bot.user}")

@bot.command(name="caminetto")
async def caminetto(ctx, azione: str = None, quantita: int = 1):
    channel_id = str(ctx.channel.id)

    if azione is None:
        wood, _, elapsed = get_channel_data(channel_id)
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

    elif azione.lower() == "aggiungi":
        if quantita < 1:
            quantita = 1
        wood, _, elapsed = get_channel_data(channel_id)
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
            set_channel_wood(channel_id, wood)
            countdown = get_countdown(wood, elapsed)
            extra = f"\n*(solo {aggiunti} pezzi erano necessari per riempirlo)*" if aggiunti < quantita else ""
            embed = discord.Embed(
                title="🔥 Caminetto",
                description=f"🪵 **{ctx.author.display_name}** aggiunge **{aggiunti}** pezzo/i di legna!\n🔥 Legna totale: **{wood}/{MAX_WOOD}**\n{countdown}{extra}",
                color=0xff6600
            )
        embed.set_footer(text="Usa !caminetto aggiungi [n] per aggiungere legna (max 5).")
        await ctx.send(embed=embed)

    elif azione.lower() == "reset":
        if not ctx.author.guild_permissions.administrator:
            await ctx.send("❌ Solo un amministratore può resettare il caminetto.")
            return
        get_channel_data(channel_id)
        set_channel_wood(channel_id, 0)
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
