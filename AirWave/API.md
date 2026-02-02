# AIRWAVE API Reference

## Base URLs

- **Backend API:** `http://localhost:3000/api`
- **WebSocket:** `ws://localhost:3000/ws`
- **Health Check:** `http://localhost:3000/health`

## REST API Endpoints

### Health Check

**GET** `/health`

Returns system health status.

**Response:**
```json
{
  "status": "healthy",
  "uptime": 123.45,
  "timestamp": "2024-10-21T17:00:00.000Z",
  "airframes": true
}
```

---

### List All Schemas

**GET** `/api/schemas`

Returns list of all available aviation data schemas.

**Response:**
```json
{
  "count": 23,
  "schemas": [
    {
      "name": "oooi_events",
      "endpoint": "/api/schemas/oooi_events"
    },
    {
      "name": "fans1a_cpdlc_message",
      "endpoint": "/api/schemas/fans1a_cpdlc_message"
    }
    // ... more schemas
  ]
}
```

---

### Get Specific Schema

**GET** `/api/schemas/:name`

Returns a specific JSON schema by name.

**Parameters:**
- `name` - Schema name (e.g., `oooi_events`, `fans1a_cpdlc_message`)

**Available Schemas:**
- `phonetic_alphabet`
- `icao_regions`
- `aviation_units`
- `qcode_reference`
- `flight_phase`
- `aircraft_identifier`
- `aerodrome_registry`
- `fans1a_adsc_contract`
- `fans1a_cpdlc_message`
- `miam_message_envelope`
- `media_advisory_status`
- `ohma_diagnostic`
- `afn_logon`
- `atn_b1_cpdlc_message`
- `atn_b1_adsc_contract`
- `aidc_message`
- `linklayer_vdl2_hfdl`
- `satcom_sbd_envelope`
- `acars_ip_envelope`
- `acars_message_security`
- `acars_label_registry`
- `pbcs_performance`
- `oooi_events`

**Response:**
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.org/schemas/oooi_events.schema.json",
  "title": "OOOI Event Model",
  "type": "object",
  "version": "0.1.0",
  "properties": {
    "id": { "type": "string" },
    "timestamp": { 
      "type": "string", 
      "format": "date-time", 
      "description": "UTC ISO-8601" 
    }
  },
  "meta": {
    "source_tier": "authoritative",
    "evidence_pending": false,
    "region_scope": "GLOBAL",
    "safety_classification": "public_standard"
  }
}
```

**Errors:**
```json
{
  "error": "Schema not found"
}
```

---

### Get Reference Data

**GET** `/api/reference/:type`

Returns CSV reference data.

**Parameters:**
- `type` - Reference data type

**Available Types:**
- `phonetic_alphabet` - ICAO/ITU phonetic alphabet
- `aviation_units` - Aviation units (feet, knots, nautical miles)
- `flight_phase` - Flight phase definitions (TAXI, TAKEOFF, etc.)

**Example:** `/api/reference/aviation_units`

**Response (CSV):**
```csv
unit,symbol,quantity,si_relation,notes
foot,ft,length,1 ft = 0.3048 m,ALTITUDE
knot,kt,speed,1 kt = 0.514444 m/s,AIRSPEED
nautical_mile,NM,length,1 NM = 1852 m,DISTANCE
```

**Errors:**
```json
{
  "error": "Reference data not found"
}
```

---

### Validate Message

**POST** `/api/validate/:schema`

Validates a message against a specific schema.

**Parameters:**
- `schema` - Schema name to validate against

**Request Body:**
```json
{
  "id": "msg_123",
  "timestamp": "2024-10-21T17:00:00.000Z"
}
```

**Response (Valid):**
```json
{
  "valid": true,
  "errors": []
}
```

**Response (Invalid):**
```json
{
  "valid": false,
  "errors": [
    {
      "instancePath": "/timestamp",
      "schemaPath": "#/properties/timestamp/format",
      "keyword": "format",
      "params": { "format": "date-time" },
      "message": "must match format \"date-time\""
    }
  ]
}
```

---

### Get Statistics

**GET** `/api/stats`

Returns system statistics (placeholder).

**Response:**
```json
{
  "message": "Statistics endpoint",
  "timestamp": "2024-10-21T17:00:00.000Z"
}
```

---

## WebSocket API

### Connection

**URL:** `ws://localhost:3000/ws`

Connect using any WebSocket client.

### Server → Client Messages

#### Connection Acknowledgment
```json
{
  "type": "connection",
  "message": "Connected to Airwave Mission Control",
  "timestamp": "2024-10-21T17:00:00.000Z"
}
```

#### ACARS Message
```json
{
  "type": "acars",
  "timestamp": "2024-10-21T17:00:00.000Z",
  "data": {
    "id": "msg_1729529400000_abc123",
    "timestamp": "2024-10-21T17:00:00.000Z",
    "app": {
      "name": "ACARS",
      "version": "2"
    },
    "source": {
      "station_id": "station_42",
      "frequency": 131.725,
      "type": "vdlm2"
    },
    "vdl": {
      "freq": 131.550,
      "channel": 2
    },
    "flight": "UAL123",
    "tail": "N12345",
    "label": "H1",
    "block_id": "ab",
    "msgno": "A1",
    "text": "OUT 1420 OFF 1425",
    "airline": "UAL",
    "category": "oooi",
    "flight_phase": "TAXI",
    "oooi": {
      "event": "OUT",
      "time": "1420",
      "timestamp": "2024-10-21T14:20:00.000Z"
    },
    "validation": {
      "valid": true,
      "errors": []
    },
    "processed_at": "2024-10-21T17:00:00.000Z",
    "message_number": 42
  }
}
```

### Message Categories

Messages are automatically categorized:

| Category | Description | Example Text |
|----------|-------------|--------------|
| `oooi` | Out, Off, On, In events | `OUT 1420 OFF 1425` |
| `position` | Position reports | `POS N3745W12230,281234,350,KSFO,KJFK` |
| `cpdlc` | Controller-Pilot Data Link | `#M1BM/C CLIMB TO AND MAINTAIN FL350` |
| `weather` | Weather reports | `WX KSFO 281256Z 27015KT 10SM` |
| `performance` | Performance data | `ETA 1845 FUEL 12.5` |
| `atc_request` | ATC requests | `REQ HIGHER DUE TURB` |
| `freetext` | Uncategorized text | Various |

### Flight Phases

| Phase | Description |
|-------|-------------|
| `TAXI` | Ground movement |
| `TAKEOFF` | Initial climb |
| `CRUISE` | Enroute level flight |
| `DESCENT` | Descent toward destination |
| `APPROACH` | Terminal area approach |
| `LANDING` | Touchdown and rollout |

### Message Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique message identifier |
| `timestamp` | string (ISO-8601) | Message timestamp (UTC) |
| `flight` | string | Flight number (e.g., "UAL123") |
| `tail` | string | Aircraft registration (e.g., "N12345") |
| `airline` | string | Airline code (e.g., "UAL") |
| `label` | string | ACARS label code |
| `text` | string | Message text content |
| `category` | string | Auto-detected category |
| `flight_phase` | string | Auto-detected flight phase |
| `oooi` | object | Parsed OOOI event (if applicable) |
| `position` | object | Parsed position data (if applicable) |
| `validation` | object | Schema validation result |
| `message_number` | number | Sequential message number |

## Rate Limits

Currently no rate limits enforced (development mode).

## Authentication

Currently no authentication required (development mode).

For production deployment with Airframes.io:
- API key: Set in environment variable `AIRFRAMES_API_KEY`
- WebSocket: Token-based authentication

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 404 | Resource not found |
| 500 | Internal server error |

## Example Usage

### cURL Examples

**Get all schemas:**
```bash
curl http://localhost:3000/api/schemas
```

**Get specific schema:**
```bash
curl http://localhost:3000/api/schemas/oooi_events | jq
```

**Get reference data:**
```bash
curl http://localhost:3000/api/reference/aviation_units
```

**Validate message:**
```bash
curl -X POST http://localhost:3000/api/validate/oooi_events \
  -H "Content-Type: application/json" \
  -d '{"id":"test","timestamp":"2024-10-21T17:00:00.000Z"}'
```

### JavaScript/TypeScript Example

```typescript
// WebSocket connection
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  console.log('Connected to Airwave');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'acars') {
    console.log('ACARS:', message.data);
  }
};

// REST API
const response = await fetch('http://localhost:3000/api/schemas');
const schemas = await response.json();
console.log(`${schemas.count} schemas available`);
```

### Python Example

```python
import websocket
import json

def on_message(ws, message):
    data = json.loads(message)
    if data['type'] == 'acars':
        print(f"Flight: {data['data']['flight']}")
        print(f"Text: {data['data']['text']}")

ws = websocket.WebSocketApp(
    "ws://localhost:3000/ws",
    on_message=on_message
)
ws.run_forever()
```

## Data Persistence

Messages are stored in JSONL format:
- **Location:** `backend/data/messages.jsonl`
- **Format:** One JSON object per line
- **Retention:** Auto-cleanup after 7 days
- **Statistics:** Aggregated in `backend/data/stats.json`

## Support

For API issues or questions:
- Check console logs in backend
- Verify WebSocket connection status
- Review message validation errors
- Consult schema definitions

---

**API Version:** 1.0.0  
**Last Updated:** 2024-10-21

