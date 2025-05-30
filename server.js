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
  const { summary, assignee, status } = req.query;

  if (!summary && !assignee && !status) {
    return res.status(400).json({
      error: "summary, assignee, status 중 하나는 반드시 포함되어야 합니다."
    });
  }

  let jqlParts = [];
  if (summary) jqlParts.push(`summary ~ "${summary}"`);
  if (assignee) jqlParts.push(`assignee = "${assignee}"`);
  if (status) jqlParts.push(`status = "${status}"`);
  const jql = jqlParts.join(' AND ');

  console.log('사용된 JQL:', jql);

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
      url: `${process.env.JIRA_BASE_URL}/browse/${issue.key}`,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      assignee: issue.fields.assignee?.displayName || '미지정'
    }));

    res.json({ issues });
  } catch (err) {
    console.error('Jira API 오류:', err.response?.data || err.message);
    res.status(500).json({ error: 'Jira API 호출 실패' });
  }
});

// Jira 댓글 요약
app.get('/api/jira/comments/summary', async (req, res) => {
  const { key, channel } = req.query;

  if (!key || !channel) {
    return res.status(400).json({ error: "Missing 'key' or 'channel'" });
  }

  const url = `${process.env.JIRA_BASE_URL}/rest/api/3/issue/${key}/comment`;

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Basic ${process.env.JIRA_API_TOKEN}`,
        Accept: 'application/json'
      }
    });

    const comments = (response.data.comments || [])
      .map(c => extractPlainText(c.body))
      .filter(Boolean)
      .slice(0, 10);

    const joined = comments.map((c, i) => `${i + 1}. ${c}`).join('\n');

    const gptRes = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "너는 Jira 댓글을 요약하는 어시스턴트야." },
        { role: "user", content: `다음 Jira 이슈의 댓글을 요약해줘:\n\n${joined}` }
      ],
      temperature: 0.3
    }, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const summary = gptRes.data.choices[0].message.content.trim();

    await axios.post('https://slack.com/api/chat.postMessage', {
      channel,
      text: `📝 *${key} 이슈 댓글 요약*\n\n${summary}`
    }, {
      headers: {
        Authorization: `Bearer ${process.env.SLACK_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({ ok: true });
  } catch (e) {
    console.error('요약 실패:', e.response?.data || e.message);
    res.status(500).json({ error: '댓글 요약 실패' });
  }
});

function extractPlainText(body) {
  try {
    return body.content.flatMap(block =>
      block.content?.map(inline => inline.text || '').filter(Boolean)
    ).join(' ');
  } catch {
    return '';
  }
}

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

// OpenAPI 명세 제공
app.get('/openapi.json', (req, res) => {
  res.type('application/json').sendFile('./openapi.json', { root: '.' });
});

// 헬스 체크
app.get('/', (_, res) => res.send('MCP Jira-to-Slack 서버 정상 동작 중 ✅'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 MCP Jira-to-Slack Bot listening on port ${PORT}`));
