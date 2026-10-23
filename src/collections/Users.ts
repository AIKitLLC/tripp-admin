import type { CollectionConfig } from 'payload'

import { reportDuplicateEmailConflict } from './unique-email-conflict'
import {
  enforceUserPrivileges,
  rateLimitUserAuth,
  roleFieldCreateAccess,
  roleFieldUpdateAccess,
  usersCreateAccess,
  usersDeleteAccess,
  usersReadAccess,
  usersUpdateAccess,
} from './users-access'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'role', 'status', 'createdAt'],
  },
  auth: {
    verify: true,
  },
  access: {
    read: usersReadAccess,
    create: usersCreateAccess,
    update: usersUpdateAccess,
    delete: usersDeleteAccess,
  },
  hooks: {
    afterError: [reportDuplicateEmailConflict],
    beforeChange: [enforceUserPrivileges],
    beforeOperation: [rateLimitUserAuth],
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      defaultValue: 'editor',
      required: true,
      access: {
        create: roleFieldCreateAccess,
        update: roleFieldUpdateAccess,
      },
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
