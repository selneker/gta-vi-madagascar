import { config } from '../src/config/index.js'
import { Channels, categoryById } from '../src/config/server.js'

const TOKEN = config.DISCORD_TOKEN
const GUILD = config.DISCORD_GUILD_ID

const base = (n) => n.replace(/^[╭│╰]ㆍ\s*/, '')

async function main() {
  const res = await fetch(`https://discord.com/api/v10/guilds/${GUILD}/channels`, {
    headers: { Authorization: `Bot ${TOKEN}` },
  })
  const channels = await res.json()
  const byId = new Map(channels.map((c) => [c.id, c]))

  let done = 0, renamed = 0, skipped = 0, errors = 0
  for (const def of Channels) {
    const parentName = def.category ? categoryById(def.category)?.name.toUpperCase() : undefined
    const target = channels.find((c) => {
      if (c.parent_id) {
        const p = byId.get(c.parent_id)
        if (!p || p.name.toUpperCase() !== parentName) return false
      }
      return base(c.name) === base(def.name)
    })
    if (!target) { console.log('SKIP  :', def.name); skipped++; continue }
    if (target.name === def.name) { console.log('OK    :', def.name); done++; continue }
    const r = await fetch(`https://discord.com/api/v10/channels/${target.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bot ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: def.name }),
    })
    if (r.ok) { console.log('RENAME:', target.name, '->', def.name); renamed++ }
    else { const txt = await r.text(); console.log('ERR   :', def.name, r.status, txt.slice(0, 100)); errors++ }
    await new Promise((r) => setTimeout(r, 700))
  }
  console.log(`\nDONE: done=${done} renamed=${renamed} skipped=${skipped} errors=${errors}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
