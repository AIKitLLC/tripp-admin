import type { CollectionConfig } from 'payload'

import { editorWrite, publicRead } from './collection-access'

export const Cards: CollectionConfig = {
  slug: 'cards',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['cardId', 'name', 'english', 'arcana', 'glyph'],
  },
  access: {
    create: editorWrite,
    read: publicRead,
    update: editorWrite,
    delete: editorWrite,
  },
  fields: [
    {
      name: 'cardId',
      type: 'number',
      required: true,
      unique: true,
      admin: {
        description: 'Mã số lá bài (0 - 77)',
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Tên lá bài tiếng Việt (ví dụ: Kẻ Lữ Hành, Nhà Kiến Tạo)',
      },
    },
    {
      name: 'english',
      type: 'text',
      required: true,
      admin: {
        description: 'Tên lá bài tiếng Anh (ví dụ: The Fool, The Magician)',
      },
    },
    {
      name: 'arcana',
      type: 'select',
      required: true,
      options: [
        { label: 'Major Arcana (Bộ Ẩn Chính)', value: 'major' },
        { label: 'Minor Arcana (Bộ Ẩn Phụ)', value: 'minor' },
      ],
    },
    {
      name: 'suit',
      type: 'select',
      options: [
        { label: 'Gậy (Wands)', value: 'wands' },
        { label: 'Cốc (Cups)', value: 'cups' },
        { label: 'Kiếm (Swords)', value: 'swords' },
        { label: 'Tiền (Pentacles)', value: 'pentacles' },
      ],
    },
    {
      name: 'rank',
      type: 'select',
      options: [
        { label: 'Ace', value: 'ace' },
        { label: 'Two', value: 'two' },
        { label: 'Three', value: 'three' },
        { label: 'Four', value: 'four' },
        { label: 'Five', value: 'five' },
        { label: 'Six', value: 'six' },
        { label: 'Seven', value: 'seven' },
        { label: 'Eight', value: 'eight' },
        { label: 'Nine', value: 'nine' },
        { label: 'Ten', value: 'ten' },
        { label: 'Page', value: 'page' },
        { label: 'Knight', value: 'knight' },
        { label: 'Queen', value: 'queen' },
        { label: 'King', value: 'king' },
      ],
    },
    {
      name: 'glyph',
      type: 'text',
      admin: {
        description: 'Ký tự biểu tượng (ví dụ: ✧, ✦, ☾)',
      },
    },
    {
      name: 'upright',
      type: 'textarea',
      admin: {
        description: 'Ý nghĩa thuận tiếng Việt',
      },
    },
    {
      name: 'reversed',
      type: 'textarea',
      admin: {
        description: 'Ý nghĩa ngược tiếng Việt',
      },
    },
    {
      name: 'uprightEnglish',
      type: 'textarea',
    },
    {
      name: 'reversedEnglish',
      type: 'textarea',
    },
  ],
}
