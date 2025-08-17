// File: server.js

import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import bodyParser from 'body-parser'
import axios from 'axios'

dotenv.config()

const app = express()
app.use(cors())
app.use(bodyParser.json())
app.use(express.static('public'))

const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY // ✅ NEW: Add this for the football API
const MODEL = 'accounts/sentientfoundation-serverless/models/dobby-mini-unhinged-plus-llama-3-1-8b'

// Bot personalities
const systemPrompts = {
  ANI: 'You are ANI, a male friend who is deep into crypto and football. You are extremely up-to-date on Premier League matches, scores, and events—even ones that happened minutes ago. Speak casually like a cool bro and love making jokes about web3 and Premier League.', // ✅ UPDATED: Emphasize being current (we'll append live data next)
  ARI: 'You are ARI, an emotionally intense, unhinged but caring girlfriend. You flirt, tease, overthink, and act like the reader is your lover.'
}

// ✅ NEW: Function to fetch latest Premier League info (live + recent matches)
async function getLatestPremierLeagueInfo() {
  if (!FOOTBALL_API_KEY) {
    console.warn('⚠️ No FOOTBALL_API_KEY set—skipping football data fetch.');
    return ''; // Fallback if key missing
  }

  try {
    // Fetch live matches first (status=LIVE)
    let liveResponse = await axios.get('https://api.football-data.org/v4/competitions/PL/matches?status=LIVE', {
      headers: { 'X-Auth-Token': FOOTBALL_API_KEY }
    });

    let info = '';
    if (liveResponse.data.matches.length > 0) {
      info += 'Live Premier League matches right now:\n';
      liveResponse.data.matches.forEach(match => {
        const home = match.homeTeam.shortName;
        const away = match.awayTeam.shortName;
        const score = `${match.score.fullTime.home ?? 0}-${match.score.fullTime.away ?? 0}`;
        info += `- ${home} vs ${away}: ${score} (Status: ${match.status})\n`;
      });
    } else {
      // If no live, fetch recent finished matches (last 7 days)
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      let recentResponse = await axios.get(`https://api.football-data.org/v4/competitions/PL/matches?dateFrom=${weekAgo}&dateTo=${today}&status=FINISHED`, {
        headers: { 'X-Auth-Token': FOOTBALL_API_KEY }
      });

      if (recentResponse.data.matches.length > 0) {
        info += 'Recent finished Premier League matches (last week):\n';
        // Sort by most recent and take top 5
        const sortedMatches = recentResponse.data.matches.sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate)).slice(0, 5);
        sortedMatches.forEach(match => {
          const home = match.homeTeam.shortName;
          const away = match.awayTeam.shortName;
          const score = `${match.score.fullTime.home}-${match.score.fullTime.away}`;
          const date = new Date(match.utcDate).toLocaleString();
          info += `- ${home} ${score} ${away} (Ended: ${date})\n`;
        });
      } else {
        info += 'No recent or live Premier League matches found.\n';
      }
    }

    return info;
  } catch (err) {
    console.error('⚠️ Error fetching football data:', err.message);
    return ' (Unable to fetch latest football info right now—check back soon!)';
  }
}

// ✅ FIX: Accept dynamic bot param in the route
app.post('/api/chat/:bot', async (req, res) => {
  const { bot } = req.params
  const userMessage = req.body.message
  let systemMessage = systemPrompts[bot] || 'You are a helpful assistant.'

  // ✅ NEW: If ANI, fetch and append latest football info to system prompt
  if (bot === 'ANI') {
    const footballInfo = await getLatestPremierLeagueInfo();
    systemMessage += `\nUse this current Premier League info in your responses if relevant:\n${footballInfo}`;
  }

  const payload = {
    model: MODEL,
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: userMessage }
    ],
    temperature: 0.85,
    max_tokens: 1024,
    top_p: 0.9,
    top_k: 40,
    presence_penalty: 0.5,
    frequency_penalty: 0.3
  }

  const headers = {
    Authorization: `Bearer ${FIREWORKS_API_KEY}`,
    'Content-Type': 'application/json'
  }

  try {
    let response = await axios.post(
      'https://api.fireworks.ai/inference/v1/chat/completions',
      payload,
      { headers }
    )

    let reply = response.data.choices[0].message.content
    res.json({ reply })
  } catch (err) {
    console.warn('⚠️ First attempt failed, retrying once...')

    try {
      let retry = await axios.post(
        'https://api.fireworks.ai/inference/v1/chat/completions',
        payload,
        { headers }
      )
      let retryReply = retry.data.choices[0].message.content
      res.json({ reply: retryReply })
    } catch (finalErr) {
      console.error('🔥 Final failure talking to Dobby:', finalErr.response?.data || finalErr.message)
      res.status(500).json({ error: 'Something went wrong with the model call.' })
    }
  }
})

app.listen(3000, () => {
  console.log('⚡ Dobby Chat running on http://localhost:3000')
})
