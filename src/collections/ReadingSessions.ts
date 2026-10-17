import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'

import { actorRole, adminOrOwn, authenticated, isAdminRole } from './collection-access'

const stampReadingSessionUser: CollectionBeforeChangeHook = ({ data, operation, req }) => {
  if (!data) return data
  const role = actorRole(req.user)
  if (operation === 'create' && req.user && !isAdminRole(role)) {
    return { ...data, user: req.user.id }
  }
  if (operation === 'update' && !isAdminRole(role) && 'user' in data) {
    const { user: _user, ...rest } = data
    return rest
  }
  return data
}

export const ReadingSessions: CollectionConfig = {
  slug: 'reading-sessions',
  admin: {
    useAsTitle: 'sessionId',
    defaultColumns: ['sessionId', 'spreadId', 'turns', 'model', 'status', 'createdAt'],
  },
  access: {
    create: authenticated,
    read: adminOrOwn('user'),
    update: adminOrOwn('user'),
    delete: adminOrOwn('user'),
  },
  hooks: {
    beforeChange: [stampReadingSessionUser],
  },
  fields: [
    {
      name: 'sessionId',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Mã phiên đọc bài (UUID hoặc Opaque string)',
      },
    },
    {
      name: 'question',
      type: 'textarea',
      admin: {
        description: 'Câu hỏi hoặc tâm sự của người dùng',
      },
    },
    {
      name: 'spreadId',
      type: 'text',
      admin: {
        description: 'Kiểu trải bài đã chọn (daily, three, love, etc.)',
      },
    },
    {
      name: 'drawnCards',
      type: 'json',
      admin: {
        description: 'Danh sách các lá bài đã bốc kèm chiều thuận/ngược',
      },
    },
    {
      name: 'turns',
      type: 'number',
      defaultValue: 1,
      admin: {
        description: 'Số lượt trò chuyện trong phiên',
      },
    },
    {
      name: 'model',
      type: 'text',
      defaultValue: '@cf/qwen/qwen3-30b-a3b-fp8',
      admin: {
        description: 'Mô hình AI đã xử lý lượt đọc bài',
      },
    },
    {
      name: 'tokenUsage',
      type: 'json',
      admin: {
        description: 'Thống kê lượng token sử dụng (input/output)',
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Completed', value: 'completed' },
        { label: 'Abandoned', value: 'abandoned' },
        { label: 'Flagged (Cần kiểm duyệt)', value: 'flagged' },
      ],
    },
    {
      name: 'language',
      type: 'text',
      defaultValue: 'vi',
    },
    {
      name: 'clientIp',
      type: 'text',
      admin: {
        description: 'IP nguồn (ẩn danh/hash)',
      },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      admin: {
        description: 'Account that owns this session',
      },
    },
  ],
}
