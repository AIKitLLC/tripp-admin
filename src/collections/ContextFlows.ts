import type { CollectionConfig } from 'payload'

export const ContextFlows: CollectionConfig = {
  slug: 'context-flows',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'branch', 'status', 'revision', 'updatedAt'],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      defaultValue: 'Default Flow',
    },
    {
      name: 'branch',
      type: 'select',
      required: true,
      defaultValue: 'conversation',
      options: [
        { label: 'Hội thoại chung (conversation)', value: 'conversation' },
        { label: 'Mời trải bài mới (new_reading_offer)', value: 'new_reading_offer' },
        { label: 'Luận giải lá bài (interpret)', value: 'interpret' },
        { label: 'Luận giải mở rộng (extra_interpret)', value: 'extra_interpret' },
        { label: 'Kiến thức Tarot (knowledge)', value: 'knowledge' },
        { label: 'Lời khuyên thực tế (practical)', value: 'practical' },
        { label: 'Làm rõ câu hỏi (clarify_reading)', value: 'clarify_reading' },
        { label: 'Gợi ý kiểu trải (suggest_spread)', value: 'suggest_spread' },
        { label: 'Bổ sung thông tin (supplement)', value: 'supplement' },
        { label: 'Hỗ trợ cảm xúc (emotional_support)', value: 'emotional_support' },
        { label: 'Chủ đề mới (new_topic)', value: 'new_topic' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'published',
      options: [
        { label: 'Published (Đang kích hoạt)', value: 'published' },
        { label: 'Draft (Bản nháp)', value: 'draft' },
        { label: 'Archived (Lưu trữ)', value: 'archived' },
      ],
    },
    {
      name: 'revision',
      type: 'number',
      defaultValue: 1,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'tone',
      type: 'select',
      defaultValue: 'warm',
      options: [
        { label: 'Ấm áp, tự nhiên (Warm)', value: 'warm' },
        { label: 'Ngắn gọn, rõ ràng (Concise)', value: 'concise' },
        { label: 'Thấu cảm, hỗ trợ (Supportive)', value: 'supportive' },
      ],
    },
    {
      name: 'depth',
      type: 'select',
      defaultValue: 'balanced',
      options: [
        { label: 'Ngắn gọn (Brief)', value: 'brief' },
        { label: 'Cân bằng (Balanced)', value: 'balanced' },
        { label: 'Chuyên sâu (Deep)', value: 'deep' },
      ],
    },
    {
      name: 'ownerQualityInstructions',
      type: 'textarea',
      admin: {
        description: 'Chỉ dẫn chất lượng câu trả lời từ chủ sở hữu (Owner instructions)',
      },
    },
    {
      name: 'testerQualityInstructions',
      type: 'textarea',
      admin: {
        description: 'Chỉ dẫn bổ sung từ tester/biên tập viên (Tester instructions)',
      },
    },
    {
      name: 'nodes',
      type: 'json',
      admin: {
        description: 'Cấu hình chi tiết các node trong Context Flow pipeline',
      },
    },
  ],
}
