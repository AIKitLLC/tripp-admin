import { Forbidden, type CollectionBeforeChangeHook, type CollectionBeforeDeleteHook, type CollectionConfig } from 'payload'

import { adminOnly, denyAll } from './collection-access'

const rejectAuditChange: CollectionBeforeChangeHook = ({ data, operation, req }) => {
  if (operation === 'update' || req.context?.auditAppend !== true) throw new Forbidden()
  return data
}

const rejectAuditDelete: CollectionBeforeDeleteHook = () => {
  throw new Forbidden()
}

export const AuditLogs: CollectionConfig = {
  slug: 'audit-logs',
  admin: {
    useAsTitle: 'action',
    defaultColumns: ['action', 'actor', 'target', 'createdAt'],
  },
  access: {
    create: denyAll,
    read: adminOnly,
    update: denyAll,
    delete: denyAll,
  },
  hooks: {
    beforeChange: [rejectAuditChange],
    beforeDelete: [rejectAuditDelete],
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
