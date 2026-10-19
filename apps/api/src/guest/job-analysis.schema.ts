export const JOB_ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['targetKind', 'targetRole', 'requirements'],
  properties: {
    targetKind: {
      type: 'string',
      enum: ['different_track', 'operational', 'specialist', 'same_track', 'first_job'],
    },
    targetRole: { type: 'string' },
    requirements: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'category'],
        properties: {
          text: { type: 'string' },
          category: { type: 'string', enum: ['ELIMINATORY', 'NEGOTIABLE', 'DECORATIVE'] },
        },
      },
    },
  },
};
