import { withPayload } from '@payloadcms/next/withPayload'
import path from 'node:path'

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  // Packages with Cloudflare Workers (workerd) specific code
  // Read more: https://opennext.js.org/cloudflare/howtos/workerd
  serverExternalPackages: ['jose', 'pg-cloudflare'],

  turbopack: {
    resolveAlias: {
      'drizzle-kit/api': './src/empty-shim.ts',
      'drizzle-kit': './src/empty-shim.ts',
    },
  },

  // Your Next.js config here
  webpack: (webpackConfig: any) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }
    webpackConfig.resolve.alias = {
      ...webpackConfig.resolve.alias,
      'drizzle-kit/api': path.resolve('./src/empty-shim.ts'),
      'drizzle-kit': path.resolve('./src/empty-shim.ts'),
    }

    return webpackConfig
  },
}

const config = withPayload(nextConfig, { devBundleServerPackages: false })

if (config.serverExternalPackages) {
  config.serverExternalPackages = config.serverExternalPackages.filter(
    (pkg: string) => !pkg.startsWith('drizzle-kit')
  )
}
if (config.outputFileTracingExcludes?.['**/*']) {
  config.outputFileTracingExcludes['**/*'] = config.outputFileTracingExcludes['**/*'].filter(
    (pkg: string) => !pkg.startsWith('drizzle-kit')
  )
}

export default config

