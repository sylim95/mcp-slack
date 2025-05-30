import express from 'express';
import axios from 'axios';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Google Search API
app.get('/api/search/food', async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: "Missing 'query' parameter" });

  try {
    const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: process.env.GOOGLE_API_KEY,
        cx: process.env.GOOGLE_CX_ID,
        q: query
      }
    });

    const results = (response.data.items || []).map(item => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet
    }));

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Slack 메시지 전송
app.post('/api/slack/send', async (req, res) => {
  const { channel, message } = req.body;
  if (!channel || !message) return res.status(400).json({ error: "Missing 'channel' or 'message'" });

  try {
    const result = await axios.post('https://slack.com/api/chat.postMessage', {
      channel,
      text: message
    }, {
      headers: {
        Authorization: `Bearer ${process.env.SLACK_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({ ok: result.data.ok, ts: result.data.ts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Slack app_mention 이벤트 처리
app.post('/slack/events', async (req, res) => {
  const { type, event } = req.body;

  if (type === 'url_verification') {
    return res.send({ challenge: req.body.challenge });
  }

  if (event && event.type === 'app_mention') {
    const userText = event.text || '';
    const channel = event.channel;

    try {
      const query = userText.replace(/<@\\w+>/, '').trim();
      const searchRes = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: {
          key: process.env.GOOGLE_API_KEY,
          cx: process.env.GOOGLE_CX_ID,
          q: query
        }
      });

      const items = (searchRes.data.items || []).slice(0, 3);
      const formatted = items.map((item, i) => `${i + 1}. *${item.title}*\\n${item.link}`).join('\\n\\n');

      await axios.post('https://slack.com/api/chat.postMessage', {
        channel,
        text: `📍 *"${query}" 관련 검색 결과입니다:*\n\n${formatted || '검색 결과가 없습니다.'}`
      }, {
        headers: {
          Authorization: `Bearer ${process.env.SLACK_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      res.status(200).send();
    } catch (err) {
      console.error('Slack event error:', err.message);
      res.status(200).send();
    }
  } else {
    res.status(200).send();
  }
});

app.get('/openapi.json', (req, res) => {
  const spec = fs.readFileSync(path.join(__dirname, 'openapi.json'));
  res.type('application/json').send(spec);
});

app.get('/', (req, res) => {
  res.send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
