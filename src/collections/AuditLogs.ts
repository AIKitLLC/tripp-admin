import type { CollectionConfig } from 'payload'

export const AuditLogs: CollectionConfig = {
  slug: 'audit-logs',
  admin: {
    useAsTitle: 'action',
    defaultColumns: ['action', 'actor', 'target', 'createdAt'],
  },
  fields: [
    {
      name: 'action',
      type: 'text',
      required: true,
      admin: {
        description: 'Tên hành động (ví dụ: LOGIN, FLOW_UPDATE, CARD_EDIT)',
      },
    },
    {
      name: 'actor',
      type: 'text',
      required: true,
      admin: {
        description: 'Người thực hiện (Email hoặc User ID)',
      },
    },
    {
      name: 'target',
      type: 'text',
      admin: {
        description: 'Đối tượng bị tác động (ID, Collection, etc.)',
      },
    },
    {
      name: 'details',
      type: 'json',
      admin: {
        description: 'Chi tiết thông số hoặc thay đổi',
      },
    },
    {
      name: 'ipAddress',
      type: 'text',
    },
  ],
}
