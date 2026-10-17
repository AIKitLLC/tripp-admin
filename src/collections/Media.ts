import type { CollectionConfig } from 'payload'

import { editorWrite, publicRead } from './collection-access'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    create: editorWrite,
    read: publicRead,
    update: editorWrite,
    delete: editorWrite,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
  upload: {
    // These are not supported on Workers yet due to lack of sharp
    crop: false,
    focalPoint: false,
  },
}
