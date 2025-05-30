import express from 'express';
import axios from 'axios';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Jira 이슈 조회
app.get('/api/jira/issues', async (req, res) => {
  const { summary } = req.query;

  if (!summary) {
    return res.status(400).json({ error: "Missing 'summary' query parameter." });
  }

  const jql = `summary ~ "${summary}" ORDER BY updated DESC`;
  const jiraUrl = `${process.env.JIRA_BASE_URL}/rest/api/3/search`;

  try {
    const response = await axios.get(jiraUrl, {
      headers: {
        Authorization: `Basic ${process.env.JIRA_API_TOKEN}`,
        Accept: 'application/json'
      },
      params: {
        jql,
        maxResults: 5,
        fields: 'key,summary,status,assignee'
      }
    });

    const issues = response.data.issues.map(issue => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      assignee: issue.fields.assignee?.displayName
    }));

    res.json({ issues });
  } catch (err) {
    console.error("Jira API error:", err.message);
    res.status(500).json({ error: "Jira API 호출 실패" });
  }
});

// Slack 메시지 전송
app.post('/api/slack/send', async (req, res) => {
  const { channel, message, imageUrl } = req.body;

  if (!channel || !message) {
    return res.status(400).json({ error: "Missing 'channel' or 'message'" });
  }

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: message
      }
    }
  ];

  if (imageUrl) {
    blocks.push({
      type: 'image',
      image_url: imageUrl,
      alt_text: '첨부된 이미지'
    });
  }

  try {
    const result = await axios.post('https://slack.com/api/chat.postMessage', {
      channel,
      text: message,
      blocks
    }, {
      headers: {
        Authorization: `Bearer ${process.env.SLACK_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({ ok: result.data.ok, ts: result.data.ts });
  } catch (err) {
    console.error("Slack API error:", err.message);
    res.status(500).json({ error: "Slack 메시지 전송 실패" });
  }
});

// GPT Tool용 OpenAPI 명세
app.get('/openapi.json', (req, res) => {
  res.type('application/json').sendFile('./openapi.json', { root: '.' });
});

// 헬스 체크
app.get('/', (_, res) => res.send('MCP Jira-to-Slack 서버 정상 동작 중 ✅'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 MCP Jira-to-Slack Bot listening on port ${PORT}`));
