# 🌙 Lunelle Backend API

Base URL:

http://localhost:3001

The Lunelle frontend communicates with the backend using REST APIs.

---

## API Overview

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Check backend status |
| GET | `/api/journal` | Get all journal entries |
| GET | `/api/journal/:id` | Get one journal entry |
| POST | `/api/journal` | Create a journal entry |
| PUT | `/api/journal/:id` | Update a journal entry |
| DELETE | `/api/journal/:id` | Delete a journal entry |
| POST | `/api/ai/chat` | Generate Lunelle AI reflection |

---

# 1. Health Check

## GET `/api/health`

Checks whether the backend is running.

### Request

No body required.

### Example

```http
GET /api/health
