# Notification System Design

## Stage 1

**Endpoints:**

`GET /api/v1/notifications` — fetch paginated notifications
`PATCH /api/v1/notifications/:id/read` — mark as read
`POST /api/v1/notifications/broadcast` — admin broadcast

**Headers (all requests):**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
X-Student-ID: 1042
```

**GET response:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "uuid",
        "title": "New Placement Drive",
        "category": "placements",
        "message": "Google is hiring Full Stack Developers.",
        "isRead": false,
        "createdAt": "2026-06-10T11:45:00Z"
      }
    ],
    "pagination": { "currentPage": 1, "totalPages": 5, "totalItems": 45 }
  }
}
```

**Real-Time: Server-Sent Events (SSE)**
`GET /api/v1/notifications/stream` — server pushes new notifications to active clients.
Chosen over WebSockets because notifications are one-directional (server → client only). SSE is simpler, browser-native, and auto-reconnects.

---

## Stage 2

**DB Choice: PostgreSQL**
Chosen for strict schema validation, foreign key constraints, and efficient relational joins for targeted queries (e.g. unread per student).

**Schema:**
```sql
CREATE TABLE students (
    student_id SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    email      VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id      INT REFERENCES students(student_id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    category        VARCHAR(50) NOT NULL CHECK (category IN ('placements', 'events', 'results')),
    message         TEXT NOT NULL,
    is_read         BOOLEAN DEFAULT FALSE NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

**Scale problems & solutions:**
- Slow reads → monthly range partitioning on `created_at`
- Unread badge COUNT queries → cache counts in Redis with TTL
- Bulk insert locks → batch inserts in chunks of 1000

---

## Stage 3

**Why the query is slow:**
```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;
```
No index = full table scan of 5,000,000 rows. Causes heavy disk I/O.

**Fix — Composite Index:**
```sql
CREATE INDEX idx_notifications_student_unread_date
ON notifications (studentID, isRead, createdAt DESC);
```
Database jumps directly to student 1042's unread rows already sorted. Query time drops to under 1ms.

**"Index every column" advice — No, it is wrong.**
Every write (INSERT/UPDATE/DELETE) must rebuild all indexes. More indexes = slower writes, more RAM/disk usage, and the optimizer may pick wrong indexes.

**Students who got a Placement notification in last 7 days:**
```sql
SELECT DISTINCT studentID
FROM notifications
WHERE notificationType = 'Placement'
  AND createdAt >= NOW() - INTERVAL '7 days';
```

---

## Stage 4

**Problem:** DB getting overwhelmed by fetching notifications on every page load for 50,000+ users.

**Solutions:**

| Strategy | Pros | Cons |
|----------|------|------|
| Redis caching (TTL 60s) | Response ~2ms, huge DB load reduction | Stale data up to 60s if cache not invalidated on write |
| SSE push (no polling) | Real-time, zero repeated requests | Complex reconnect state management |
| Client-side debounce | Simple to implement | Doesn't fix backend bottleneck |

**Recommended:** Redis caching + SSE push together. Redis handles load, SSE handles freshness.

---

## Stage 5

**Problems with original `notify_all`:**
1. Synchronous loop blocks the HTTP thread for all 50,000 students
2. One failure mid-loop crashes everything — no partial recovery
3. DB connection pool exhausted by rapid sequential writes
4. No retry on transient failures

**Redesigned — Async Queue:**
```javascript
async function notify_all(student_ids, message) {
  // Bulk insert all as 'pending' first
  const batches = chunkArray(student_ids, 1000);
  for (const batch of batches) {
    await db.insertBulk('notifications', batch.map(id => ({
      student_id: id, message, status: 'pending'
    })));
  }

  // Enqueue each delivery as a background job
  for (const student_id of student_ids) {
    await notificationQueue.add('send_notification', { student_id, message }, {
      attempts: 3,
      backoff: 5000
    });
  }

  return { queued: student_ids.length }; // respond immediately
}
```

DB insert and email sending should be **separate** — insert first so no record is lost, then deliver async. Failed deliveries retry automatically without affecting others.

---

## Stage 6

**Priority Score Formula:**
```
Score = (Type Weight × 10) + (100,000,000 / ms since posted)
```

| Type | Weight |
|------|--------|
| Placement | 3 |
| Result | 2 |
| Event | 1 |

Recency component decreases over time automatically — old notifications sink, new ones float to the top. No manual re-sort needed on new arrivals.

Full implementation in `notification_app_be/service/priorityInbox.js` — fetches live data from the API, scores all notifications, sorts descending, returns top 10.