import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post('/insert', async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Missing text' });
  }

  // MCP Proxy가 읽을 수 있도록 stdout으로 출력
  console.log(JSON.stringify({
    tool: "insertText",
    payload: {
      text
    }
  }));

  res.json({ message: 'Text sent to MCP Proxy' });
});

app.get('/openapi.json', (req, res) => {
  const jsonPath = path.join(process.cwd(), 'openapi.json');
  res.type('application/json').send(fs.readFileSync(jsonPath, 'utf-8'));
});

app.listen(3000, () => {
  console.log('MCP insertText server running on port 3000');
});
