import type { CollectionConfig } from 'payload'

import { editorWrite, publicRead } from './collection-access'

export const Spreads: CollectionConfig = {
  slug: 'spreads',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['spreadId', 'name', 'cardCount', 'description'],
  },
  access: {
    create: editorWrite,
    read: publicRead,
    update: editorWrite,
    delete: editorWrite,
  },
  fields: [
    {
      name: 'spreadId',
      type: 'select',
      required: true,
      unique: true,
      options: [
        { label: 'Thông điệp hôm nay (1 lá)', value: 'daily' },
        { label: 'Trải ba lá (3 lá)', value: 'three' },
        { label: 'Tarot tình cảm (3 lá)', value: 'love' },
        { label: 'Tarot công việc & tiền bạc (3 lá)', value: 'money' },
        { label: 'Một câu hỏi rõ - Yes / No (1 lá)', value: 'yes_no' },
        { label: 'Tarot theo năm (12 lá)', value: 'yearly' },
      ],
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Tên kiểu trải bài tiếng Việt',
      },
    },
    {
      name: 'nameEnglish',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'descriptionEnglish',
      type: 'textarea',
    },
    {
      name: 'cardCount',
      type: 'number',
      required: true,
      defaultValue: 3,
    },
    {
      name: 'positions',
      type: 'json',
      admin: {
        description: 'Cấu hình chi tiết các vị trí lá bài trong trải (mảng positions)',
      },
    },
  ],
}
