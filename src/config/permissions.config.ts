export const rolePermissions = {
  manager: ['inventory.manage', 'requests.approve', 'users.manage', 'reports.view', 'messages.manage', 'archive.view'],
  warehouse: ['inventory.manage', 'requests.issue', 'returns.review', 'maintenance.create'],
  user: ['requests.create', 'custody.view.self', 'returns.create', 'suggestions.create', 'messages.send']
} as const;
