export type AppRole = 'manager' | 'warehouse' | 'user';

export type NavigationItem = {
  href: string;
  label: string;
  icon:
    | 'dashboard'
    | 'requests'
    | 'returns'
    | 'custody'
    | 'inventory'
    | 'approvals'
    | 'notifications'
    | 'audit'
    | 'messages'
    | 'users'
    | 'archive'
    | 'maintenance'
    | 'purchases'
    | 'reports'
    | 'suggestions'
    | 'email';
  roles?: AppRole[];
  group: 'main' | 'operations' | 'governance' | 'management';
};

export const navigationItems: NavigationItem[] = [
  {
    href: '/dashboard',
    label: 'لوحة المعلومات',
    icon: 'dashboard',
    roles: ['manager', 'warehouse', 'user'],
    group: 'main',
  },

  {
    href: '/requests',
    label: 'الطلبات',
    icon: 'requests',
    roles: ['manager', 'warehouse', 'user'],
    group: 'operations',
  },
  {
    href: '/returns',
    label: 'الإرجاعات',
    icon: 'returns',
    roles: ['manager', 'warehouse', 'user'],
    group: 'operations',
  },
  {
    href: '/custody',
    label: 'العهد',
    icon: 'custody',
    roles: ['manager', 'warehouse'],
    group: 'operations',
  },
  {
    href: '/inventory',
    label: 'المخزون',
    icon: 'inventory',
    roles: ['manager', 'warehouse'],
    group: 'operations',
  },
  {
    href: '/maintenance',
    label: 'الصيانة',
    icon: 'maintenance',
    roles: ['manager', 'warehouse'],
    group: 'operations',
  },
  {
    href: '/purchases',
    label: 'الشراء المباشر',
    icon: 'purchases',
    roles: ['manager', 'warehouse'],
    group: 'operations',
  },

  {
    href: '/notifications',
    label: 'الإشعارات',
    icon: 'notifications',
    roles: ['manager', 'warehouse', 'user'],
    group: 'governance',
  },
  {
    href: '/audit-logs',
    label: 'سجل التدقيق',
    icon: 'audit',
    roles: ['manager'],
    group: 'governance',
  },
  {
    href: '/reports',
    label: 'التقارير',
    icon: 'reports',
    roles: ['manager'],
    group: 'governance',
  },
  {
    href: '/archive',
    label: 'الأرشيف',
    icon: 'archive',
    roles: ['manager'],
    group: 'governance',
  },

  {
    href: '/messages',
    label: 'المراسلات',
    icon: 'messages',
    roles: ['manager', 'warehouse', 'user'],
    group: 'management',
  },
  {
    href: '/email-drafts',
    label: 'المراسلات الخارجية',
    icon: 'email',
    roles: ['manager'],
    group: 'management',
  },
  {
    href: '/users',
    label: 'المستخدمون',
    icon: 'users',
    roles: ['manager'],
    group: 'management',
  },
  {
    href: '/suggestions',
    label: 'المقترحات',
    icon: 'suggestions',
    roles: ['manager', 'warehouse', 'user'],
    group: 'management',
  },
];