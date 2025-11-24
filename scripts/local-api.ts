import 'dotenv/config';
import { createServer } from 'node:http';
import { parse as parseUrl } from 'node:url';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler from '../api/research';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

createServer(async (req, res) => {
  if (!req.url || !req.method) {
    res.statusCode = 400;
    res.end('Bad Request');
    return;
  }

  const parsedUrl = parseUrl(req.url, true);
  const chunks: Buffer[] = [];

  req.on('data', chunk => chunks.push(chunk));

  req.on('end', async () => {
    const bodyStr = Buffer.concat(chunks).toString();
    let body: unknown;

    if (bodyStr) {
      try {
        body = JSON.parse(bodyStr);
      } catch {
        body = bodyStr;
      }
    }

    const vercelReq = req as VercelRequest;
    vercelReq.query = parsedUrl.query;
    (vercelReq as VercelRequest).body = body;
    vercelReq.cookies = {};

    const vercelRes = res as VercelResponse;
    vercelRes.status = (statusCode: number) => {
      res.statusCode = statusCode;
      return vercelRes;
    };
    vercelRes.json = payload => {
      const data = JSON.stringify(payload);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(data);
      return vercelRes;
    };

    await handler(vercelReq, vercelRes);
  });
}).listen(PORT, () => {
  console.log(`Local API ready at http://localhost:${PORT}/api/research?query=...`);
});

