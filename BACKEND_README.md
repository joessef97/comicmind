# ComicMind Backend

ComicMind is a TypeScript and Express backend for creating, saving, and sharing AI-generated comics. MongoDB stores application records through Mongoose. Generated image files are stored with Cloudinary when configured, with local disk storage as a fallback.

## What the backend provides

- JWT-based registration, login, current-user, and password-reset endpoints
- AI story and panel-image generation, including character-reference support
- MongoDB persistence for users, password resets, comics, drafts, ratings, and comments
- Public comic browsing, publishing, sharing, and download tracking
- Content-safety checks, rate limiting, and per-user comic access
- PDF and PNG comic downloads
- Cloudinary image storage, with local disk fallback

## Stack

- Node.js, Express 5, and TypeScript
- MongoDB and Mongoose
- OpenAI for story and image generation
- JWT and bcrypt for authentication
- Cloudinary or local disk for generated images
- Vitest and Supertest for tests

## Local setup

Use Node.js 20 or newer and a MongoDB instance, either local or hosted.

Install dependencies:

~~~bash
npm install
~~~

Create a .env file in the repository root and set the required values:

~~~dotenv
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/comicmind
JWT_SECRET=replace-with-a-long-random-secret
OPENAI_API_KEY=your-openai-api-key
~~~

Optional settings:

~~~dotenv
OPENAI_IMAGE_MODEL=gpt-image-2
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
APP_BASE_URL=http://localhost:5000
~~~

Cloudinary settings enable hosted image storage. Without them, the backend uses local disk storage under the uploads directory. SMTP settings are needed for password-reset email delivery.

Start the full development server:

~~~bash
npm run dev
~~~

The API listens on port 5000 by default. In development, the server also starts the Vite frontend. Set PORT to change the API port.

## API overview

Protected endpoints use a bearer token:

~~~http
Authorization: Bearer <token>
~~~

### Authentication

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | /api/auth/register | Public | Create an account |
| POST | /api/auth/login | Public | Sign in and receive a token |
| GET | /api/auth/me | Authenticated | Get the current user |
| POST | /api/auth/forgot-password | Public | Request a password-reset email |
| POST | /api/auth/reset-password | Public | Set a new password with the emailed token |

Registration requires a username, email, and password:

~~~json
{
  "username": "reader123",
  "email": "reader@example.com",
  "password": "a-long-password"
}
~~~

Login uses username and password. Passwords must be 8 to 128 characters. JWTs expire after seven days.

### Comics and generation

Comic endpoints are mounted under /api/comics. The main operations include:

- POST /api/comics/generate-story — create a six-panel story from a title, idea, and art style
- POST /api/comics/generate-character-ref — create a character reference image
- POST /api/comics/generate-images — generate panel images
- POST /api/comics/retry-panel — retry one failed panel
- POST /api/comics — save a comic
- GET /api/comics — list the authenticated user's comics
- GET /api/comics/:id — read one of the user's comics
- PUT /api/comics/:id — update a comic
- DELETE /api/comics/:id — delete a comic
- PATCH /api/comics/:id/publish — publish or unpublish a comic
- GET /api/comics/public — browse published comics
- GET /api/comics/:id/download?format=pdf — download a comic as PDF or PNG

Generation and write endpoints require authentication. Public browse and download routes do not require a token. Comic and panel input is validated and moderated by the backend.

### Generation jobs

| Method | Path | Purpose |
|---|---|---|
| POST | /api/jobs/generate | Start panel generation and receive a job ID |
| GET | /api/jobs/active | Find the signed-in user's active generation job |
| GET | /api/jobs/:id | Read job state and per-panel results |
| GET | /api/jobs/:id/events | Receive progress updates over server-sent events |

Generation job progress is persisted in MongoDB. The events endpoint lets the browser follow progress and reconnect to an existing job.
### Drafts, ratings, and comments

| Method | Path | Purpose |
|---|---|---|
| POST | /api/drafts | Create a draft |
| GET | /api/drafts | List the signed-in user's drafts |
| GET | /api/drafts/:id | Read a draft |
| PUT | /api/drafts/:id | Update a draft |
| DELETE | /api/drafts/:id | Delete a draft |
| DELETE | /api/drafts/stale | Clean up stale drafts |
| POST | /api/comics/:id/rating | Add or update a rating |
| GET | /api/comics/:id/ratings | List ratings |
| GET | /api/comics/:id/ratings/summary | Get the average and count |
| GET | /api/comics/:id/rating/mine | Get the current user's rating |
| POST | /api/comics/:id/comments | Add a comment |
| GET | /api/comics/:id/comments | List comments |
| DELETE | /api/comments/:id | Delete the current user's comment |

Draft writes, ratings, and comment creation or deletion require authentication.

## Data and image storage

The storage adapter in backend/src/services/storage.service.ts uses Mongoose models. MongoDB stores user accounts, password-reset records, comics and their panel metadata, drafts, ratings, and comments. Comic records use MongoDB ObjectIds, and panel data is embedded in comic documents.

Image files are stored separately from those MongoDB records. The image-storage service uses Cloudinary when configured and otherwise writes files to local disk. Comic and panel data keep the corresponding image URLs and storage identifiers.

## Security and validation

- Passwords are hashed with bcrypt.
- Authenticated requests use signed JWT bearer tokens.
- Comic and draft access is scoped to the owning user.
- Request rate limits apply to authentication and AI-generation routes.
- Content-safety middleware checks user input and edited panels.
- Password-reset tokens are stored as hashes and expire after 45 minutes.
- API errors are returned as JSON with a message field.

## Project layout

~~~text
backend/src/
  config/       MongoDB connection
  middleware/   authentication, rate limits, content safety, translation, errors
  modules/      auth, comics, drafts, comments, ratings, users
  services/     Mongo storage, AI, images, email, translation, comic downloads
  utils/        content filtering and logging
shared/         request and domain types shared with the frontend
tests/          unit and API tests
~~~

## Build and checks

~~~bash
npm run check
npm test
npm run test:api
npm run build
npm start
~~~

npm run dev is the local development command. npm start runs the production build.

## License

MIT