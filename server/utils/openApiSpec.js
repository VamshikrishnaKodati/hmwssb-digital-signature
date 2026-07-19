const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'HMWSSB Digital Signature API',
    description: 'Works Management System with OTP-based PAdES-B-B compliant digital signature for Hyderabad Metropolitan Water Supply and Sewerage Board',
    version: '1.0.0',
    contact: { name: 'HMWSSB IT Department' },
  },
  servers: [
    { url: '/api', description: 'API Base' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      Estimate: {
        type: 'object',
        properties: {
          estimateId: { type: 'string' },
          nameOfWork: { type: 'string' },
          region: { type: 'string' },
          zone: { type: 'string' },
          division: { type: 'string' },
          circle: { type: 'string' },
          ward: { type: 'string' },
          status: { type: 'string', enum: ['Draft', 'Abstract Generated', 'Submitted', 'DGM Review', 'Reverted', 'GM Review', 'OTP Pending', 'Digitally Signed', 'Hash Signed', 'Completed'] },
          materialCost: { type: 'number' },
          civilCost: { type: 'number' },
          subtotal: { type: 'number' },
          gstAmount: { type: 'number' },
          lsAmount: { type: 'number' },
          grandTotal: { type: 'number' },
          locked: { type: 'boolean' },
          digitalSignature: { type: 'string' },
          signedBy: { type: 'object' },
          signedAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      EstimateItem: {
        type: 'object',
        properties: {
          material: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string', enum: ['Material', 'Civil'] },
          unit: { type: 'string' },
          rate: { type: 'number' },
          qty: { type: 'number' },
          gst: { type: 'number', enum: [0, 5, 12, 18, 28] },
          amount: { type: 'number' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string' },
          error: { type: 'string' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        responses: { '200': { description: 'Service healthy' }, '503': { description: 'Service degraded' } },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login with username/password',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', properties: { username: { type: 'string' }, password: { type: 'string' } }, required: ['username', 'password'] },
            },
          },
        },
        responses: { '200': { description: 'Login successful' }, '401': { description: 'Invalid credentials' } },
      },
    },
    '/estimates': {
      get: {
        tags: ['Estimates'],
        summary: 'List estimates (paginated)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'zone', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Paginated estimates' } },
      },
      post: {
        tags: ['Estimates'],
        summary: 'Create estimate',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['estimateId', 'nameOfWork'],
                properties: {
                  estimateId: { type: 'string' },
                  nameOfWork: { type: 'string' },
                  region: { type: 'string' },
                  zone: { type: 'string' },
                  items: { type: 'array', items: { $ref: '#/components/schemas/EstimateItem' } },
                  lsAmount: { type: 'number' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Estimate created' }, '409': { description: 'Estimate ID already exists' } },
      },
    },
    '/estimates/{id}': {
      get: {
        tags: ['Estimates'],
        summary: 'Get estimate by ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Estimate details' }, '404': { description: 'Not found' } },
      },
      patch: {
        tags: ['Estimates'],
        summary: 'Update estimate',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Updated' } },
      },
      delete: {
        tags: ['Estimates'],
        summary: 'Delete estimate',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Deleted' } },
      },
    },
    '/estimates/{id}/status': {
      patch: {
        tags: ['Estimates'],
        summary: 'Update estimate status (workflow transition)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', enum: ['Abstract Generated', 'Submitted', 'DGM Review', 'GM Review', 'OTP Pending', 'Reverted', 'Digitally Signed', 'Hash Signed', 'Completed'] },
                  comments: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Status updated' }, '403': { description: 'Unauthorized transition' } },
      },
    },
    '/estimates/{id}/movements': {
      get: {
        tags: ['Estimates'],
        summary: 'Get estimate movement history',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Movement history' } },
      },
    },
    '/otp/send': {
      post: {
        tags: ['OTP'],
        summary: 'Send OTP for digital signature',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['estimateId', 'email', 'mobile'],
                properties: {
                  estimateId: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  mobile: { type: 'string', pattern: '^[6-9]\\d{9}$' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'OTP sent' }, '429': { description: 'Rate limited' } },
      },
    },
    '/otp/resend': {
      post: {
        tags: ['OTP'],
        summary: 'Resend OTP',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'object', required: ['estimateId'], properties: { estimateId: { type: 'string' } } },
            },
          },
        },
        responses: { '200': { description: 'OTP resent' } },
      },
    },
    '/otp/verify': {
      post: {
        tags: ['OTP'],
        summary: 'Verify OTP and generate digital signature',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['estimateId', 'otp'],
                properties: {
                  estimateId: { type: 'string' },
                  otp: { type: 'string', pattern: '^\\d{6}$' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Signature generated' }, '400': { description: 'Invalid OTP' } },
      },
    },
    '/pdf/generate': {
      post: {
        tags: ['PDF'],
        summary: 'Generate abstract PDF',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'PDF binary' } },
      },
    },
    '/pdf/{estimateId}': {
      get: {
        tags: ['PDF'],
        summary: 'Serve abstract PDF',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'estimateId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'PDF binary' } },
      },
    },
    '/items': {
      get: {
        tags: ['Items'],
        summary: 'List items',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Item list' } },
      },
      post: {
        tags: ['Items'],
        summary: 'Create item',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Item created' } },
      },
    },
    '/items/search': {
      get: {
        tags: ['Items'],
        summary: 'Search items by name/code',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'category', in: 'query', schema: { type: 'string', enum: ['Material', 'Civil'] } },
        ],
        responses: { '200': { description: 'Search results' } },
      },
    },
    '/reports': {
      get: {
        tags: ['Reports'],
        summary: 'Get filtered report data',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Report data' } },
      },
    },
    '/reports/export/csv': {
      get: {
        tags: ['Reports'],
        summary: 'Export reports as CSV',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'CSV file' } },
      },
    },
    '/reports/export/excel': {
      get: {
        tags: ['Reports'],
        summary: 'Export reports as Excel',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Excel file' } },
      },
    },
    '/reports/dashboard-stats': {
      get: {
        tags: ['Reports'],
        summary: 'Get dashboard statistics',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Dashboard stats' } },
      },
    },
    '/reports/audit-logs': {
      get: {
        tags: ['Reports'],
        summary: 'Get audit logs (admin only)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Audit logs' } },
      },
    },
    '/signatures/verify/{estimateId}': {
      get: {
        tags: ['Signatures'],
        summary: 'Verify digital signature',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'estimateId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Verification result' } },
      },
    },
    '/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'Get user notifications',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Notification list' } },
      },
    },
  },
  tags: [
    { name: 'System', description: 'Health and monitoring' },
    { name: 'Auth', description: 'Authentication' },
    { name: 'Estimates', description: 'Estimate CRUD and workflow' },
    { name: 'OTP', description: 'OTP send/verify for digital signatures' },
    { name: 'PDF', description: 'PDF generation and serving' },
    { name: 'Items', description: 'Item master management' },
    { name: 'Reports', description: 'Reports and analytics' },
    { name: 'Signatures', description: 'Digital signature verification' },
    { name: 'Notifications', description: 'User notifications' },
  ],
};

export const serveOpenApiSpec = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(openApiSpec);
};
