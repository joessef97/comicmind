# ComicMind Backend API

Backend implementation for ComicMind: AI Comic Book Creator Webservice

## Features

- ✅ User authentication with JWT
- ✅ Story generation using OpenAI GPT-4
- ✅ Image generation using DALL-E 3
- ✅ Character-consistent prompts
- ✅ Fault-tolerant panel generation with retry mechanism
- ✅ Content safety filtering
- ✅ Comic CRUD operations
- ✅ User gallery 
- ✅ In-memory storage (easily replaceable with PostgreSQL)

## Technology Stack

- **Node.js** + **Express.js** - Backend framework
- **TypeScript** - Type-safe development
- **OpenAI API** - Story and image generation
- **JWT** - Authentication
- **bcrypt** - Password hashing
- **Drizzle ORM** - Database schema management

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Add your OpenAI API key to `.env`:
```
OPENAI_API_KEY=sk-...
JWT_SECRET=your-secret-key
```

4. Run development server:
```bash
npm run dev
```

The server will start on `http://localhost:5000`

## API Endpoints

### Authentication

#### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "user123",
  "password": "password123"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "user123",
  "password": "password123"
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

### Comic Generation

#### Generate Story
```http
POST /api/comics/generate-story
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "The Hero's Journey",
  "idea": "A young hero discovers magical powers",
  "style": "anime"
}
```

Styles: `anime`, `realistic`, `cartoon`, `noir`, `comic`

#### Generate Panel Images
```http
POST /api/comics/generate-images
Authorization: Bearer <token>
Content-Type: application/json

{
  "panels": [...],
  "style": "anime"
}
```

#### Retry Single Panel
```http
POST /api/comics/retry-panel
Authorization: Bearer <token>
Content-Type: application/json

{
  "panel": {...},
  "style": "anime"
}
```

### Comic Management

#### Save Comic
```http
POST /api/comics
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "My Comic",
  "style": "anime",
  "idea": "...",
  "panels": [...]
}
```

#### Get All User Comics
```http
GET /api/comics?limit=10&offset=0
Authorization: Bearer <token>
```

#### Get Single Comic
```http
GET /api/comics/:id
Authorization: Bearer <token>
```

#### Update Comic
```http
PUT /api/comics/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated Title",
  "panels": [...]
}
```

#### Delete Comic
```http
DELETE /api/comics/:id
Authorization: Bearer <token>
```

## Content Safety

The backend includes a content filter that blocks inappropriate words in:
- Comic titles
- Story ideas

Blocked content returns:
```json
{
  "message": "Your content contains inappropriate or unsafe words. Please modify your input."
}
```

## Panel Structure

Each panel contains:
```typescript
{
  "number": 1,
  "description": "Visual scene description",
  "dialogue": "Character speech",
  "narration": "Narrative text",
  "imageUrl": "https://...",  // Added after generation
  "error": "error message"     // Present if generation failed
}
```

## Error Handling

- Failed panel generation doesn't stop the process
- Each panel is generated independently
- Failed panels can be retried individually
- All errors return JSON with `{ message: "..." }`

## Storage

Currently uses in-memory storage (`MemStorage`).

To use PostgreSQL:
1. Set `DATABASE_URL` in `.env`
2. Run migrations: `npm run db:push`
3. Implement `DBStorage` class in `backend/storage.ts`

## Security

- Passwords hashed with bcrypt (10 salt rounds)
- JWT tokens expire in 7 days
- Protected routes require authentication
- Content safety filtering on input
- User isolation for comics (users only see their own)

## Production Deployment

1. Set environment variables:
   - `OPENAI_API_KEY`
   - `JWT_SECRET` (strong random key)
   - `NODE_ENV=production`
   
2. Build:
```bash
npm run build
```

3. Start:
```bash
npm start
```

## Development

Build and check types:
```bash
npm run check
```

## Project Structure

```
backend/
├── index.ts          # Express app setup
├── routes.ts         # API routes
├── auth.ts           # Authentication & JWT
├── ai-service.ts     # OpenAI integration
├── content-filter.ts # Safety filtering
├── storage.ts        # Data storage interface
├── static.ts         # Static file serving
└── vite.ts           # Vite dev server integration
```

## License

MIT
