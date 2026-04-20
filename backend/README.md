# Leave Tracker Backend

Simple Express API for managing employee attendance data.

## Setup

```bash
cd backend
npm install
```

## Run

```bash
npm start
```

Server runs at `http://localhost:4000`

## API Endpoints

- `GET /employees` — list all employees
- `GET /attendance?year=2026&month=3` — get attendance (optional filters)
- `PUT /attendance` — set entry `{ key: "Name__2026-3-15", status: "present" }`
- `DELETE /attendance/:key` — clear entry

## Data Storage

All data persists in `data.json`
