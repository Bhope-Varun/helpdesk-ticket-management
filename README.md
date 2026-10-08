# Live Ops Helpdesk - Real-Time Ticket Locking System

A production-ready real-time ticket locking system designed for live incident management desks, customer operations, and tier-3 support teams.

The system prevents duplicate triage efforts and race conditions by establishing the Node.js Socket.IO server as the single source of truth for active ticket locks. Active locks are managed via a high-performance in-memory JavaScript `Map<ticketId, socketId>`. When an agent disconnects (network drop, tab close, computer sleep), the server instantly auto-releases all tickets owned by that socket and broadcasts updates to all connected peers.

---

## Architecture Overview

```
                      ┌─────────────────────────────────────────┐
                      │          Browser Clients (React)        │
                      │  Tab A (socket-1)       Tab B (socket-2)│
                      └───────▲───┬─────────────────▲───┬───────┘
                              │   │                 │   │
        WebSocket / Polling   │   │  join_dashboard │   │
        ticket_locked /       │   │  lock_ticket    │   │
        ticket_unlocked       │   │  unlock_ticket  │   │
                              │   ▼                 │   ▼
                      ┌─────────────────────────────────────────┐
                      │        Node.js + Express Server         │
                      │               (Port 3000)               │
                      ├─────────────────────────────────────────┤
                      │        Socket.IO Event Coordinator      │
                      │        (ticketSocket.ts)                │
                      ├─────────────────────────────────────────┤
                      │    Synchronous In-Memory Lock Service   │
                      │        ticketLocks = new Map()          │
                      │                                         │
                      │  "TICKET-101" ──► "socket-1"            │
                      │  "TICKET-102" ──► "socket-2"            │
                      └─────────────────────────────────────────┘
```

### Key Principles

1. **Server as Single Source of Truth**:
   The frontend never marks a ticket as locked permanently until receiving affirmative confirmation from the server.
2. **Event-Loop Atomicity**:
   Ticket locking is synchronous. There are no asynchronous awaits between checking lock presence and setting the map entry, eliminating concurrent double-allocation race conditions in Node.js.
3. **Automatic Disconnect Release**:
   If a client tab closes, crashes, or loses network connectivity, the server triggers `socket.on('disconnect')`, purges every ticket belonging to that socket ID from `ticketLocks`, and broadcasts `ticket_unlocked` with `reason: 'owner_disconnected'`.
4. **Ownership Protection**:
   Only the socket ID that acquired a lock can explicitly unlock that ticket. Attempts by other sockets trigger `unlock_rejected`.

---

## Technologies

- **Runtime**: Node.js (v20+)
- **Server Framework**: Express.js
- **Real-Time Communication**: Socket.IO (Server & Client v4.8+)
- **State Store**: In-Memory JavaScript `Map`
- **Frontend Framework**: React 19 + TypeScript
- **Bundler & Tooling**: Vite 8 + TSX
- **Styling**: Tailwind CSS
- **Icons**: Lucide React

---

## Socket Event Protocol

### Client to Server (`Client -> Server`)

| Event | Payload | Description |
|---|---|---|
| `join_dashboard` | `void` | Requests current full snapshot of active locks upon client connection/reconnection. |
| `lock_ticket` | `{ ticketId: string }` | Requests an exclusive lock on the specified ticket ID for the sender's socket. |
| `unlock_ticket` | `{ ticketId: string }` | Releases the ticket lock if the sender's socket is the current owner. |

### Server to Client (`Server -> Client`)

| Event | Payload | Description |
|---|---|---|
| `lock_state` | `Array<{ ticketId: string, lockedBy: string }>` | Full initial lock state dispatched to a client upon joining. |
| `ticket_locked` | `{ ticketId: string, lockedBy: string }` | Broadcast to all clients when a ticket is successfully locked. |
| `ticket_unlocked` | `{ ticketId: string, reason: 'manual' \| 'owner_disconnected' }` | Broadcast to all clients when a lock is released. |
| `lock_rejected` | `{ ticketId: string, reason: string, currentOwner?: string }` | Sent only to the requesting socket when a lock attempt fails. |
| `unlock_rejected` | `{ ticketId: string, reason: string, currentOwner?: string }` | Sent only to the requesting socket when an unlock attempt fails. |

---

## Installation & Setup

### Prerequisites
- Node.js (v18 or higher)
- npm or pnpm

### 1. Clone & Install
```bash
git clone <repository_url>
cd <repository_folder>
npm install
```

### 2. Environment Variables
Create a `.env` file based on `.env.example`:
```env
PORT=3000
NODE_ENV=development
```

### 3. Running the Server

#### Development Mode (Full-stack Vite + Express on Port 3000):
```bash
npm run dev
```

#### Production Build & Run:
```bash
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## How to Test Using Two Browser Tabs

The dashboard includes a built-in **QA & Concurrency Bench** at the top of the interface to facilitate rapid verification:

### TEST 1: Basic Lock Propagation
1. Open [http://localhost:3000](http://localhost:3000) in Tab A.
2. Open [http://localhost:3000](http://localhost:3000) in Tab B (or click **"1. Open Second Tab"**).
3. In Tab A, click **"Lock Ticket"** on `TICKET-101`.
4. **Expected**:
   - Tab A shows `TICKET-101` as **"Locked by You"** with an **Unlock** button.
   - Tab B immediately shows `TICKET-101` as **"Locked by Other"** with a disabled **Locked** button and Tab A's socket ID.

### TEST 2: Lock Contention / Rejection
1. In Tab B, attempt to lock `TICKET-101` (or simulate concurrent click).
2. **Expected**:
   - Server checks `ticketLocks.get("TICKET-101")`, sees Tab A owns it, and emits `lock_rejected`.
   - Tab B displays an error toast: *"Ticket is already locked"*.
   - Tab A remains the sole owner without interruption.

### TEST 3: Manual Unlock
1. In Tab A, click **"Unlock"** on `TICKET-101`.
2. **Expected**:
   - Tab A releases the lock.
   - Both Tab A and Tab B immediately display `TICKET-101` as **Available** with green badges.

### TEST 4: Browser Crash / Tab Disconnect Auto-Release
1. In Tab A, lock `TICKET-101`.
2. Observe Tab B displaying `TICKET-101` as locked.
3. In Tab A, either close the tab or click **"2. Disconnect Socket"** in the QA bench.
4. **Expected**:
   - The server detects the socket disconnect.
   - The server searches `ticketLocks`, finds `TICKET-101` was owned by Tab A, and deletes it.
   - The server broadcasts `ticket_unlocked` with `{ ticketId: "TICKET-101", reason: "owner_disconnected" }`.
   - Tab B immediately updates `TICKET-101` to **Available** without page refresh.

### TEST 5: Multiple Ticket Ownership Disconnect
1. In Tab A, click **"3. Lock Multi (101-103)"** to acquire locks on `TICKET-101`, `TICKET-102`, and `TICKET-104`.
2. Observe Tab B displaying all three tickets as locked by Tab A.
3. Close Tab A or click **"Disconnect Socket"**.
4. **Expected**:
   - Server's `releaseTicketsForSocket(socketId)` iterates through `ticketLocks` and collects all three keys.
   - Server broadcasts individual `ticket_unlocked` events for each ticket.
   - Tab B automatically updates all three tickets to **Available**.

---

## Architectural Rationale: In-Memory Map vs Database

### Why In-Memory Map is Ideal for Single-Process Deployments
1. **Sub-Millisecond Latency**:
   Lock checks and mutations complete in nanoseconds, eliminating database query overhead.
2. **Zero Async Race Windows**:
   In Node.js, synchronous JavaScript operations are executed sequentially on the single thread. Checking `ticketLocks.has(ticketId)` followed by `ticketLocks.set(ticketId, socketId)` is completely atomic without requiring pessimistic database row locking or distributed mutexes.
3. **Clean Disconnect Garbage Collection**:
   The server handles thousands of concurrent socket disconnects per second in pure memory without issuing slow SQL `DELETE FROM locks WHERE socket_id = ?` batch queries.

### Multi-Server Limitations & Production Scaling Path
When scaling horizontally across multiple Node.js instances behind a load balancer:
- **Limitation**: An in-memory `Map` is local to each process memory space. A socket connected to Server 1 would not be aware of locks created on Server 2.
- **Production Solution**:
  1. **Socket.IO Redis Adapter**: To broadcast events across multiple server instances (`@socket.io/redis-adapter`).
  2. **Shared Distributed Lock Store (Redis)**: Replace the local JavaScript `Map` with Redis commands such as `SET ticket:lock:<id> <socketId> NX EX <ttl>` (Redlock pattern) or Redis Lua scripts to maintain atomicity and coordinate locks across all instances.
  3. **Heartbeat TTLs**: Use Redis key expiration (TTL) paired with client keep-alive pings to ensure locks expire even if an entire server node encounters sudden hardware failure.
