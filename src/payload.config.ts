import fs from 'fs'
import path from 'path'
import { sqliteD1Adapter } from '@payloadcms/db-d1-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import { CloudflareContext, getCloudflareContext } from '@opennextjs/cloudflare'
import { GetPlatformProxyOptions } from 'wrangler'
import { r2Storage } from '@payloadcms/storage-r2'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Cards } from './collections/Cards'
import { Spreads } from './collections/Spreads'
import { ContextFlows } from './collections/ContextFlows'
import { ReadingSessions } from './collections/ReadingSessions'
import { AuditLogs } from './collections/AuditLogs'
import { rememberOwnerEmailBinding } from './lib/owner-email'
import { rememberRateLimitBindings } from './lib/rate-limit'
import { readBindingSecret, readNextPhase, resolvePayloadSecret } from './lib/payload-secret'
import { createRedactingLogger } from './lib/redact-log'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const realpath = (value: string) => (fs.existsSync(value) ? fs.realpathSync(value) : undefined)

const isCLI = process.argv.some((value) => realpath(value)?.endsWith(path.join('payload', 'bin.js')))
const isProduction = process.env.NODE_ENV === 'production'
const isNextBuild = readNextPhase() === 'phase-production-build'

const redactingLogger = createRedactingLogger()

const cloudflare =
  isCLI || !isProduction || isNextBuild
    ? await getCloudflareContextFromWrangler()
    : await getCloudflareContext({ async: true })

rememberOwnerEmailBinding(cloudflare.env)
rememberRateLimitBindings(cloudflare.env)

const secret = resolvePayloadSecret({
  envSecret: process.env.PAYLOAD_SECRET,
  bindingSecret: readBindingSecret(cloudflare.env),
  nodeEnv: process.env.NODE_ENV,
  nextPhase: readNextPhase(),
})

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Cards, Spreads, ContextFlows, ReadingSessions, AuditLogs],
  editor: lexicalEditor(),
  secret,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: sqliteD1Adapter({ binding: cloudflare.env.D1, logger: false }),
  logger: redactingLogger as any,
  plugins: [
    r2Storage({
      bucket: cloudflare.env.R2,
      collections: { media: true },
    }),
  ],
})

function platformProxyPersist(): GetPlatformProxyOptions['persist'] {
  if (process.env.VITEST) return { path: '.wrangler/state/vitest' }
  if (isNextBuild) return false
  return undefined
}

// Adapted from https://github.com/opennextjs/opennextjs-cloudflare/blob/d00b3a13e42e65aad76fba41774815726422cc39/packages/cloudflare/src/api/cloudflare-context.ts#L328C36-L328C46
function getCloudflareContextFromWrangler(): Promise<CloudflareContext> {
  return import(/* webpackIgnore: true */ `${'__wrangler'.replaceAll('_', '')}`).then(
    ({ getPlatformProxy }) =>
      getPlatformProxy({
        environment: process.env.CLOUDFLARE_ENV,
        remoteBindings: isProduction && !isNextBuild,
        persist: platformProxyPersist(),
      } satisfies GetPlatformProxyOptions),
  )
}
