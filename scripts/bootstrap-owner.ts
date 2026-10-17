import { OwnerBootstrapError, loadPayloadAndBootstrap } from '../src/lib/bootstrap-owner'
import { redactLoggedValue } from '../src/lib/redact-log'

const password = process.env.OWNER_PASSWORD
if (!password) {
  console.error('OWNER_PASSWORD is not set. Refusing to bootstrap.')
  process.exit(1)
}

try {
  const result = await loadPayloadAndBootstrap(password)
  console.log(result === 'created' ? 'Owner bootstrap created the owner.' : 'Owner bootstrap is closed.')
} catch (error) {
  if (error instanceof OwnerBootstrapError) {
    console.error(error.message)
  } else {
    console.error(JSON.stringify(redactLoggedValue(error)))
  }
  process.exit(1)
}
