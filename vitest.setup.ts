// Load .env files
import 'dotenv/config'

if (!process.env.PAYLOAD_SECRET) {
  process.env.PAYLOAD_SECRET = 'local-dev-only-placeholder'
}

if (!process.env.OWNER_EMAIL?.trim()) {
  process.env.OWNER_EMAIL = 'owner@example.com'
}
