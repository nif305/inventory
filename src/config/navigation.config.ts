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
    | 'cleaning'
    | 'purchases'
    | 'reports'
    | 'suggestions'
    | 'other'
    | 'email';
  roles?: AppRole[];
  group: 'main' | 'primary' | 'services' | 'messages' | 'governance';
};

export const navigationItems: NavigationItem[] = [
  {
    href: '/dashboard',
    label: 'لوحة التحكم',
    icon: 'dashboard',
    roles: ['manager', 'warehouse', 'user'],
    group: 'main',
  },

  {
    href: '/inventory',
    label: 'المخزون',
    icon: 'inventory',
    roles: ['manager', 'warehouse'],
    group: 'primary',
  },
  {
    href: '/requests',
    label: 'الطلبات التشغيلية',
    icon: 'requests',
    roles: ['manager', 'warehouse', 'user'],
    group: 'primary',
  },
  {
    href: '/returns',
    label: 'الإرجاعات التشغيلية',
    icon: 'returns',
    roles: ['manager', 'warehouse', 'user'],
    group: 'primary',
  },

  {
    href: '/maintenance',
    label: 'الصيانة',
    icon: 'maintenance',
    roles: ['manager', 'warehouse'],
    group: 'services',
  },
  {
    href: '/cleaning',
    label: 'النظافة',
    icon: 'cleaning',
    roles: ['manager', 'warehouse'],
    group: 'services',
  },
  {
    href: '/purchases',
    label: 'الشراء المباشر',
    icon: 'purchases',
    roles: ['manager', 'warehouse'],
    group: 'services',
  },
  {
    href: '/suggestions?category=OTHER',
    label: 'الطلبات الأخرى',
    icon: 'other',
    roles: ['manager', 'warehouse'],
    group: 'services',
  },

  {
    href: '/messages',
    label: 'المراسلات الداخلية',
    icon: 'messages',
    roles: ['manager', 'warehouse', 'user'],
    group: 'messages',
  },
  {
    href: '/email-drafts',
    label: 'المراسلات الخارجية',
    icon: 'email',
    roles: ['manager'],
    group: 'messages',
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
    href: '/audit-logs',
    label: 'سجل التدقيق',
    icon: 'audit',
    roles: ['manager'],
    group: 'governance',
  },
  {
    href: '/users',
    label: 'المستخدمون',
    icon: 'users',
    roles: ['manager'],
    group: 'governance',
  },
  {
    href: '/notifications',
    label: 'الإشعارات',
    icon: 'notifications',
    roles: ['manager', 'warehouse', 'user'],
    group: 'governance',
  },

  {
    href: '/custody',
    label: 'العهد',
    icon: 'custody',
    roles: ['manager', 'warehouse'],
    group: 'governance',
  },
];
