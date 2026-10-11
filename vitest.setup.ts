// Load .env files
import 'dotenv/config'

if (!process.env.PAYLOAD_SECRET) {
  process.env.PAYLOAD_SECRET = 'local-dev-only-placeholder'
}
