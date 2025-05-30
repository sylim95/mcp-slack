
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

async function refineQueryWithGPT(userText) {
  try {
    const prompt = `사용자가 말한 내용을 검색에 적합한 핵심 키워드로 바꿔줘:\"${userText}\"`;
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "너는 사용자의 자연어 질문을 검색 키워드로 바꿔주는 AI야." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7
    }, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content.trim();
  } catch (e) {
    console.error("GPT 키워드 추출 실패:", e.message);
    return userText; // fallback
  }
}

app.post('/slack/events', async (req, res) => {
  const { type, event } = req.body;

  if (type === 'url_verification') return res.send({ challenge: req.body.challenge });

  if (event && event.type === 'app_mention') {
    const rawText = event.text.replace(/<@[^>]+>/, '').trim();
    const channel = event.channel;

    const refined = await refineQueryWithGPT(rawText);

    try {
      const searchRes = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: {
          key: process.env.GOOGLE_API_KEY,
          cx: process.env.GOOGLE_CX_ID,
          q: refined
        }
      });

      const items = (searchRes.data.items || []).slice(0, 3);
      const formatted = items.map((item, i) => `${i + 1}. *${item.title}*\n${item.link}`).join('\n\n');

      await axios.post('https://slack.com/api/chat.postMessage', {
        channel,
        text: `📍 *"${refined}" 검색 결과입니다:*

${formatted || '검색 결과가 없습니다.'}`
      }, {
        headers: {
          Authorization: `Bearer ${process.env.SLACK_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      res.status(200).send();
    } catch (err) {
      console.error('검색 실패:', err.message);
      res.status(200).send();
    }
  } else {
    res.status(200).send();
  }
});

app.get('/', (req, res) => res.send('OK'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ MCP GPT Bot running on port ${PORT}`));
