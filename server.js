const express = require('express')
const fetch = require('node-fetch')
const cors = require('cors')
const path = require('path')

const app = express()
app.use(cors())
app.use(express.json())
// Serve static files (index.html, assets) from project root so visiting / returns the site
app.use(express.static(path.join(__dirname)))

const REMOTE = 'https://plantsvsbrainrotsstocktracker.com/api/stock'
let cached = { ts: 0, data: null }
const TTL = 10 * 1000 // 10s cache

function normalize(items){
	const seeds = []
	const gear = []
	for(const it of (items||[])){
		const name = it.name || it.item || ''
		const category = (it.category || it.type || '').toLowerCase()
		const nameLower = name.toLowerCase()
		const entry = { name, stock: typeof it.stock === 'number' ? it.stock : (it.currentStock ?? 0), available: (typeof it.available==='boolean'?it.available:((it.stock||0)>0)), lastUpdated: it.lastUpdated }
		// Keywords that indicate an item is gear
		const gearKeywords = ['gun','grenade','bucket','blower','launcher','spray','fertilizer','launcher']
		// Classify based on category first (handles 'SEEDS'/'SEED'/'GEAR')
		if(category && category.includes('seed')) {
			seeds.push(entry)
		} else if(category && category.includes('gear')) {
			gear.push(entry)
		} else if(nameLower.includes('seed')) {
			seeds.push(entry)
		} else if(gearKeywords.some(k => nameLower.includes(k))) {
			gear.push(entry)
		} else {
			// Default to seeds for ambiguous items to avoid showing seeds in gear
			seeds.push(entry)
		}
	}
	return { seeds, gear }
}

app.get('/api/stock', async (req, res) => {
	try{
		const now = Date.now()
		if(cached.data && (now - cached.ts) < TTL) return res.json(cached.data)
		const r = await fetch(REMOTE, { headers: { 'Accept': 'application/json' } })
		if(!r.ok) return res.status(502).json({ error: 'upstream error' })
		let data = await r.json()
		if(data && data.data && Array.isArray(data.data)) data = data.data
		const norm = normalize(data)
		cached = { ts: now, data: norm }
		return res.json(norm)
	}catch(err){
		console.error(err)
		return res.status(500).json({ error: 'internal' })
	}
})

const PORT = process.env.PORT || 3000
app.listen(PORT, ()=> console.log('Server listening on', PORT))