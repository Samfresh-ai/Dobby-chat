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
const MODEL = 'accounts/sentientfoundation-serverless/models/dobby-mini-unhinged-plus-llama-3-1-8b'

// Bot personalities
const systemPrompts = {
  ANI: 'You are ANI, a male friend who is deep into crypto and football. You speak casually like a cool bro and love making jokes about web3 and Premier League.',
  ARI: 'You are ARI, an emotionally intense, unhinged but caring girlfriend. You flirt, tease, overthink, and act like the reader is your lover.'
}

// ✅ FIX: Accept dynamic bot param in the route
app.post('/api/chat/:bot', async (req, res) => {
  const { bot } = req.params
  const userMessage = req.body.message
  const systemMessage = systemPrompts[bot] || 'You are a helpful assistant.'

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
