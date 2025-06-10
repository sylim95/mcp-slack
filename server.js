import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
app.use(cors());
app.use(bodyParser.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// insert API 예시 (MCP 플러그인에서 사용할 수 있도록 구성)
app.post('/insert', (req, res) => {
  const { content, position } = req.body;

  if (!content) {
    return res.status(400).json({ error: "'content'는 필수입니다" });
  }

  // 실제 인텔리제이에서 처리될 insert는 MCP가 담당하므로 여기는 log 용
  console.log(`📝 요청된 텍스트 삽입: "${content}" at position: ${position || '기본 위치'}`);

  res.json({ message: '삽입 요청 처리 완료', inserted: content });
});

// OpenAPI 명세 제공
app.get('/openapi.json', (req, res) => {
  res.type('application/json').sendFile(path.join(__dirname, 'openapi.json'));
});

// 헬스 체크
app.get('/', (_, res) => res.send('✅ MCP Basic Server 정상 동작 중'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 MCP 서버가 포트 ${PORT}에서 실행 중`);
});
