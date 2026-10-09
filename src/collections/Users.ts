import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'role', 'status', 'createdAt'],
  },
  auth: true,
  fields: [
    {
      name: 'role',
      type: 'select',
      defaultValue: 'editor',
      required: true,
      options: [
        { label: 'Owner (Toàn quyền)', value: 'owner' },
        { label: 'Admin (Quản trị)', value: 'admin' },
        { label: 'Editor (Biên tập viên)', value: 'editor' },
        { label: 'Viewer (Chỉ xem)', value: 'viewer' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Suspended', value: 'suspended' },
      ],
    },
    {
      name: 'telegramId',
      type: 'text',
      admin: {
        description: 'Telegram ID cho admin bot (nếu tích hợp)',
      },
    },
    {
      name: 'lastLoginAt',
      type: 'date',
      admin: {
        readOnly: true,
      },
    },
  ],
  versions: false,
}
