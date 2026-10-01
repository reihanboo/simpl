export type EmployeeRole = 'cashier' | 'warehouse_staff' | 'manager';

export function normalizeEmployeeRole(value: unknown): EmployeeRole | undefined {
  if (typeof value !== 'string') return undefined;
  const role = value.trim().toLocaleLowerCase('id-ID').replace(/[_-]+/g, ' ');
  switch (role) {
    case 'kasir':
    case 'cashier':
      return 'cashier';
    case 'staf gudang':
    case 'staff gudang':
    case 'warehouse staff':
    case 'warehouse':
      return 'warehouse_staff';
    case 'manajer toko':
    case 'manager toko':
    case 'manajer':
    case 'manager':
    case 'store manager':
      return 'manager';
    default:
      return undefined;
  }
}
