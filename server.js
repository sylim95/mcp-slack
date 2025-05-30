import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();

// ✅ GPT MCP 연결 위해 CORS 허용
app.use(cors());
app.use(bodyParser.json());

app.post('/api/slack/send', async (req, res) => {
  const { channel, message } = req.body;

  try {
    const result = await axios.post(
      'https://slack.com/api/chat.postMessage',
      {
        channel,
        text: message,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SLACK_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({ ok: result.data.ok, ts: result.data.ts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/', (req, res) => {
  res.send('OK');
});

app.get('/health', (req, res) => {
  res.send('Healthy');
});

app.get('/openapi.json', (req, res) => {
  const spec = fs.readFileSync(path.join(__dirname, 'openapi.json'));
  res.type('application/json').send(spec);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
