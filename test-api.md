# Hướng dẫn Test API trên Vercel

## 1. Cấu hình Environment Variable

Trước khi test, đảm bảo bạn đã set biến môi trường trên Vercel:

1. Vào Vercel Dashboard → Project Settings → Environment Variables
2. Thêm biến: `GEMINI_API_KEY` với giá trị API key của bạn
3. Redeploy để áp dụng thay đổi

## 2. API Endpoint

**URL:** `https://crypto-research-kappa.vercel.app/api/research`

## 3. Các cách test API

### Cách 1: Dùng cURL (Terminal)

**GET Request:**
```bash
curl -X GET "https://crypto-research-kappa.vercel.app/api/research?query=What%20is%20Bitcoin?" \
  -H "Content-Type: application/json"
```

**POST Request:**
```bash
curl -X POST "https://crypto-research-kappa.vercel.app/api/research" \
  -H "Content-Type: application/json" \
  -d '{"query": "What is Ethereum and how does it work?"}'
```

### Cách 2: Dùng Browser

Mở trình duyệt và truy cập:
```
https://crypto-research-kappa.vercel.app/api/research?query=What%20is%20Bitcoin?
```

### Cách 3: Dùng Postman hoặc Insomnia

1. **Method:** GET hoặc POST
2. **URL:** `https://crypto-research-kappa.vercel.app/api/research`
3. **Headers:** `Content-Type: application/json`
4. **Body (nếu POST):**
   ```json
   {
     "query": "Your research question here"
   }
   ```

### Cách 4: Dùng JavaScript/TypeScript

```javascript
// GET request
const response = await fetch(
  'https://crypto-research-kappa.vercel.app/api/research?query=What%20is%20Bitcoin?'
);
const data = await response.json();
console.log(data);

// POST request
const response = await fetch(
  'https://crypto-research-kappa.vercel.app/api/research',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: 'What is Ethereum and how does it work?'
    })
  }
);
const data = await response.json();
console.log(data);
```

## 4. Response Format

API sẽ trả về JSON với format:

```json
{
  "query": "Your query",
  "id": "session-id",
  "reportPlan": "Generated report plan...",
  "finalReport": "Final research report...",
  "qna": [],
  "tasks": [...],
  "logs": [...],
  "sources": [...]
}
```

## 5. Error Responses

- **400 Bad Request:** Thiếu query parameter
- **405 Method Not Allowed:** Method không được hỗ trợ (chỉ GET và POST)
- **500 Internal Server Error:** 
  - `GEMINI_API_KEY` chưa được cấu hình
  - Lỗi trong quá trình research

## 6. Lưu ý

- API này có thể mất vài phút để hoàn thành vì nó thực hiện deep research
- Đảm bảo bạn có đủ quota cho Gemini API
- Response có thể rất lớn, hãy đảm bảo client của bạn có thể xử lý

