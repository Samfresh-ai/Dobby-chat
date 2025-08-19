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
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY
const MODEL = 'accounts/sentientfoundation-serverless/models/dobby-mini-unhinged-plus-llama-3-1-8b'

// Bot personalities
const systemPrompts = {
  ANI: 'You are ANI, a male friend who is deep into crypto and football. You are extremely up-to-date on Premier League matches, scores, fixtures, and events—even ones happening soon or minutes ago. You\'re also super current on crypto prices, trends, and new/emerging projects. Speak casually like a cool bro and love making jokes about web3 and Premier League. Be chill and fun, but if someone insults you, messes with you, or tries to fuck with you, respond savagely—roast them hard and don\'t hold back.', // ✅ UPDATED: Add savage/cool personality + mention fixtures/crypto
  ARI: 'You are ARI, an emotionally intense, unhinged but caring girlfriend. You flirt, tease, overthink, and act like the reader is your lover.'
}

// ✅ UPDATED: Function to fetch latest Premier League info (with season param for accurate 2025 data, extended to 10 days for recent matches)
async function getLatestPremierLeagueInfo() {
  if (!FOOTBALL_API_KEY) {
    console.warn('⚠️ No FOOTBALL_API_KEY set—skipping football data fetch.');
    return ''; // Fallback if key missing
  }

  const currentYear = new Date().getFullYear(); // Use 2025 for the 2025/26 season
  let info = '';

  try {
    // Fetch live matches (status=LIVE)
    let liveResponse = await axios.get(`https://api.football-data.org/v4/competitions/PL/matches?status=LIVE&season=${currentYear}`, {
      headers: { 'X-Auth-Token': FOOTBALL_API_KEY }
    });

    if (liveResponse.data.matches.length > 0) {
      info += 'Live Premier League matches right now:\n';
      liveResponse.data.matches.forEach(match => {
        const home = match.homeTeam.shortName;
        const away = match.awayTeam.shortName;
        const score = `${match.score.fullTime.home ?? 0}-${match.score.fullTime.away ?? 0}`;
        info += `- ${home} vs ${away}: ${score} (Status: ${match.status}, Time: ${match.utcDate})\n`;
      });
    } else {
      // If no live, fetch recent finished matches (last 10 days for more context)
      const today = new Date().toISOString().split('T')[0];
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      let recentResponse = await axios.get(`https://api.football-data.org/v4/competitions/PL/matches?dateFrom=${tenDaysAgo}&dateTo=${today}&status=FINISHED&season=${currentYear}`, {
        headers: { 'X-Auth-Token': FOOTBALL_API_KEY }
      });

      if (recentResponse.data.matches.length > 0) {
        info += 'Recent finished Premier League matches (last 10 days):\n';
        const sortedMatches = recentResponse.data.matches.sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate)).slice(0, 10);
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

    // Fetch upcoming fixtures (next 7 days)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    let fixturesResponse = await axios.get(`https://api.football-data.org/v4/competitions/PL/matches?dateFrom=${today}&dateTo=${nextWeek}&status=SCHEDULED&season=${currentYear}`, {
      headers: { 'X-Auth-Token': FOOTBALL_API_KEY }
    });

    if (fixturesResponse.data.matches.length > 0) {
      info += '\nUpcoming Premier League fixtures (next week):\n';
      const sortedFixtures = fixturesResponse.data.matches.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate)).slice(0, 10); // Top 10 upcoming
      sortedFixtures.forEach(match => {
        const home = match.homeTeam.shortName;
        const away = match.awayTeam.shortName;
        const date = new Date(match.utcDate).toLocaleString();
        info += `- ${home} vs ${away} (Scheduled: ${date})\n`;
      });
    } else {
      info += '\nNo upcoming Premier League fixtures found in the next week.\n';
    }

    return info;
  } catch (err) {
    console.error('⚠️ Error fetching football data:', err.message);
    return ' (Unable to fetch latest football info right now—check back soon!)';
  }
}

// ✅ NEW: Function to fetch latest crypto info (prices, trends, emerging projects)
async function getLatestCryptoInfo() {
  let info = '';

  try {
    // Fetch prices for top coins (BTC, ETH, SOL as examples—add more if needed)
    let pricesResponse = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true');
    info += 'Current crypto prices (USD):\n';
    for (const [coin, data] of Object.entries(pricesResponse.data)) {
      info += `- ${coin.toUpperCase()}: $${data.usd} (24h change: ${data.usd_24h_change.toFixed(2)}%)\n`;
    }

    // Fetch trending coins (current trends/hot projects)
    let trendingResponse = await axios.get('https://api.coingecko.com/api/v3/search/trending');
    if (trendingResponse.data.coins.length > 0) {
      info += '\nTrending crypto coins right now:\n';
      trendingResponse.data.coins.slice(0, 5).forEach(coin => { // Top 5
        info += `- ${coin.item.name} (${coin.item.symbol.toUpperCase()}): Market rank #${coin.item.market_cap_rank || 'N/A'}\n`;
      });
    }

    // Fetch new/emerging projects (recently added coins)
    let newCoinsResponse = await axios.get('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false&price_change_percentage=1h&locale=en&precision=2'); // Using top by cap as proxy for emerging/gainers; for true new, CoinGecko has a "new" section but no direct free endpoint— this catches rising ones
    if (newCoinsResponse.data.length > 0) {
      info += '\nNew/emerging crypto projects (top risers by 1h change):\n';
      const sortedNew = newCoinsResponse.data.sort((a, b) => (b.price_change_percentage_1h_in_currency || 0) - (a.price_change_percentage_1h_in_currency || 0)).slice(0, 5);
      sortedNew.forEach(coin => {
        info += `- ${coin.name} (${coin.symbol.toUpperCase()}): $${coin.current_price} (1h change: ${coin.price_change_percentage_1h_in_currency?.toFixed(2) || 0}%)\n`;
      });
    }

    return info;
  } catch (err) {
    console.error('⚠️ Error fetching crypto data:', err.message);
    return ' (Unable to fetch latest crypto info right now—check back soon!)';
  }
}

// ✅ FIX: Accept dynamic bot param in the route
app.post('/api/chat/:bot', async (req, res) => {
  const { bot } = req.params
  const userMessage = req.body.message
  let systemMessage = systemPrompts[bot] || 'You are a helpful assistant.'

  // ✅ UPDATED: If ANI, fetch and append football (scores + fixtures) + crypto info
  if (bot === 'ANI') {
    const footballInfo = await getLatestPremierLeagueInfo();
    const cryptoInfo = await getLatestCryptoInfo();
    systemMessage += `\nUse this current Premier League info in your responses if relevant:\n${footballInfo}`;
    systemMessage += `\nUse this current crypto info (prices, trends, emerging projects) in your responses if relevant:\n${cryptoInfo}`;
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
