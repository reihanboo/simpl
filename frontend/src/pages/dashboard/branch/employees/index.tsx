import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { normalizeEmployeeRole } from '../../../../utils/employee-role';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,

  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
  UserRoundCheck,
  X,
} from 'lucide-react';

type EmployeeStatus = 'Aktif' | 'Cuti';
type AttendanceStatus = 'Hadir' | 'Terlambat' | 'Belum masuk';

interface EmployeeRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  login_username?: string | null;
  is_current_user?: boolean;
  role: string;
  status: EmployeeStatus;
  shift: string;
  attendance_status: AttendanceStatus;
  clock_in: string | null;
  clock_out: string | null;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  loginUsername: string | null;
  isCurrentUser: boolean;
  role: string;
  status: EmployeeStatus;
  shift: string;
  attendance: AttendanceStatus;
  clockIn: string | null;
  clockOut: string | null;
  initials: string;
  color: string;
}

interface EmployeeForm {
  name: string;
  email: string;
  phone: string;
  role: string;
  status: EmployeeStatus;
  shift: string;
}

const emptyForm: EmployeeForm = {
  name: '',
  email: '',
  phone: '',
  role: 'Kasir',
  status: 'Aktif',
  shift: '',
};


const avatarColors = [
  'bg-emerald-100 text-emerald-700',
  'bg-orange-100 text-orange-700',
  'bg-cyan-100 text-cyan-700',
  'bg-fuchsia-100 text-fuchsia-700',
];

const todayLabel = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(new Date());

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
}

function mapEmployee(record: EmployeeRecord, colorIndex: number): Employee {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    phone: record.phone,
    loginUsername: record.login_username ?? null,
    isCurrentUser: record.is_current_user ?? false,
    role: record.role,
    status: record.status,
    shift: record.shift,
    attendance: record.attendance_status,
    clockIn: record.clock_in,
    clockOut: record.clock_out,
    initials: getInitials(record.name),
    color: avatarColors[colorIndex % avatarColors.length],
  };
}

function formatClock(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }).format(date);
}

function StatCard({
  label,
  value,
  detail,
  icon,
  tone,
  trend,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone: string;
  trend?: 'up' | 'down';
}) {
  return (
    <div className="flex min-h-24 flex-col justify-between border border-slate-300 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-600">{label}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
        </div>
        <span className={`flex h-9 w-9 items-center justify-center ${tone}`}>{icon}</span>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
        {trend === 'up' && <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />}
        {trend === 'down' && <ArrowDownRight className="h-3.5 w-3.5 text-amber-600" />}
        <span>{detail}</span>
      </div>
    </div>
  );
}

export default function EmployeesIndex() {
  const { id: branchId } = useParams();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<string | null>(null);

  const [pageError, setPageError] = useState('');
  const [formError, setFormError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua status');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [createCredentials, setCreateCredentials] = useState<{ username: string; temporaryPassword: string } | null>(null);

  useEffect(() => {
    if (!branchId) return;
    const controller = new AbortController();

    const loadEmployees = async () => {
      try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const response = await fetch(`/api/branches/${branchId}/employees`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Gagal memuat data pegawai.');
        const records = (payload.data || []) as EmployeeRecord[];
        setEmployees(records.map((record, index) => mapEmployee(record, index)));
        setPageError('');
      } catch (error) {
        if (!controller.signal.aborted) {
          setEmployees([]);
          setPageError(error instanceof Error ? error.message : 'Gagal memuat data pegawai.');
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void loadEmployees();
    return () => controller.abort();
  }, [branchId]);

  const filteredEmployees = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('id-ID');
    return employees.filter((employee) => {
      const matchesQuery = !normalizedQuery ||
        employee.name.toLocaleLowerCase('id-ID').includes(normalizedQuery) ||
        employee.email.toLocaleLowerCase('id-ID').includes(normalizedQuery) ||
        employee.phone.toLocaleLowerCase('id-ID').includes(normalizedQuery) ||
        employee.loginUsername?.toLocaleLowerCase('id-ID').includes(normalizedQuery) ||
        employee.role.toLocaleLowerCase('id-ID').includes(normalizedQuery);
      const matchesStatus = statusFilter === 'Semua status' || employee.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [employees, query, statusFilter]);

  const activeEmployees = employees.filter((employee) => employee.status === 'Aktif');
  const scheduledEmployees = activeEmployees
    .filter((employee) => employee.shift.trim() !== '' && employee.shift !== '—')
    .sort((first, second) => first.shift.localeCompare(second.shift, 'id-ID'));
  const presentCount = scheduledEmployees.filter((employee) => employee.clockIn && employee.attendance === 'Hadir').length;
  const lateCount = scheduledEmployees.filter((employee) => employee.clockIn && employee.attendance === 'Terlambat').length;
  const checkedInCount = scheduledEmployees.filter((employee) => employee.clockIn).length;
  const notArrivedCount = scheduledEmployees.length - checkedInCount;
  const attendanceRate = scheduledEmployees.length
    ? Math.round((checkedInCount / scheduledEmployees.length) * 100)
    : 0;
  const isEditingOwnManagerRole = Boolean(
    editingEmployee?.isCurrentUser && normalizeEmployeeRole(editingEmployee.role) === 'manager'
  );

  const openAddModal = () => {
    setCreateCredentials(null);
    setEditingEmployee(null);
    setForm(emptyForm);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (employee: Employee) => {
    setCreateCredentials(null);
    setEditingEmployee(employee);
    setForm({
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      role: employee.role,
      status: employee.status,
      shift: employee.shift === '—' ? '' : employee.shift,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSaveEmployee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!branchId) return;

    const isEditing = Boolean(editingEmployee);
    setIsSubmitting(true);
    setFormError('');
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(
        editingEmployee
          ? `/api/branches/${branchId}/employees/${editingEmployee.id}`
          : `/api/branches/${branchId}/employees`,
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...form,
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            role: form.role.trim(),
            shift: form.shift.trim(),
          }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Gagal menyimpan data pegawai.');

      const credentials = payload.credentials as { username?: unknown; temporary_password?: unknown } | undefined;
      if (typeof credentials?.username === 'string' && typeof credentials.temporary_password === 'string') {
        setCreateCredentials({ username: credentials.username, temporaryPassword: credentials.temporary_password });
      }

      if (editingEmployee) {
        const index = employees.findIndex((employee) => employee.id === editingEmployee.id);
        const savedEmployee = mapEmployee(payload.employee as EmployeeRecord, Math.max(index, 0));
        setEmployees((current) => current.map((employee) => employee.id === editingEmployee.id ? savedEmployee : employee));
      } else {
        setEmployees((current) => [...current, mapEmployee(payload.employee as EmployeeRecord, current.length)]);
        if (!credentials) setCreateCredentials(null);
      }
      setIsModalOpen(false);
      setEditingEmployee(null);
      setForm(emptyForm);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Gagal menyimpan data pegawai.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (employee: Employee) => {
    if (!branchId || !window.confirm(`Hapus ${employee.name} dari daftar pegawai?`)) return;
    setDeletingEmployeeId(employee.id);
    setPageError('');
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`/api/branches/${branchId}/employees/${employee.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Gagal menghapus data pegawai.');
      setEmployees((current) => current.filter((item) => item.id !== employee.id));
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Gagal menghapus data pegawai.');
    } finally {
      setDeletingEmployeeId(null);
    }
  };


  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm">
            <span className="font-medium text-[#21AC3A]">SIMPL</span><span className="text-slate-400">/</span><span className="text-slate-500">Manajemen pegawai</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Manajemen Pegawai</h1>
          <p className="mt-1 text-sm text-slate-500">Kelola tim, jadwal kerja, dan kehadiran dalam satu tempat. <span className="ml-2 inline-flex items-center gap-1.5 text-xs capitalize text-slate-400"><CalendarDays className="h-3.5 w-3.5" />{todayLabel}</span></p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex min-h-10 items-center justify-center gap-2 border border-[#21AC3A] bg-[#21AC3A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1d9732]"
        >
          <UserPlus className="h-4 w-4" />
          Tambah pegawai
        </button>
      </header>

      {pageError && <p role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{pageError}</p>}

      {createCredentials && (
        <section aria-label="Kredensial login pegawai" className="border border-emerald-300 bg-emerald-50 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-emerald-950">Akun login pegawai berhasil dibuat</h2>
              <p className="mt-1 text-sm leading-relaxed text-emerald-900">Kredensial ini hanya ditampilkan sekarang. Bagikan langsung kepada pegawai melalui saluran yang aman.</p>
            </div>
            <button type="button" onClick={() => setCreateCredentials(null)} className="shrink-0 p-1 text-emerald-800 hover:bg-emerald-100" aria-label="Tutup kredensial login">
              <X className="h-5 w-5" />
            </button>
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="border border-emerald-200 bg-white px-3 py-2.5">
              <dt className="text-xs font-medium text-slate-500">Username</dt>
              <dd className="mt-1 break-all font-mono text-sm text-slate-900">{createCredentials.username}</dd>
            </div>
            <div className="border border-emerald-200 bg-white px-3 py-2.5">
              <dt className="text-xs font-medium text-slate-500">Kata sandi awal (ditampilkan sekali)</dt>
              <dd className="mt-1 break-all font-mono text-sm text-slate-900">{createCredentials.temporaryPassword}</dd>
            </div>
          </dl>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total pegawai" value={String(employees.length)} detail="Pegawai terdaftar" icon={<Users className="h-5 w-5" />} tone="bg-sky-50 text-sky-700" />
        <StatCard label="Pegawai aktif" value={String(activeEmployees.length)} detail="Berstatus aktif" icon={<UserRoundCheck className="h-5 w-5" />} tone="bg-emerald-50 text-emerald-700" trend="up" />
        <StatCard label="Hadir hari ini" value={`${presentCount} orang`} detail={`${lateCount} terlambat · ${notArrivedCount} belum masuk`} icon={<Check className="h-5 w-5" />} tone="bg-violet-50 text-violet-700" />
        <StatCard label="Terlambat" value={String(lateCount)} detail="Dari pegawai terjadwal" icon={<Clock3 className="h-5 w-5" />} tone="bg-amber-50 text-amber-700" trend="down" />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0 overflow-hidden border border-slate-300 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-300 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Daftar pegawai</h2>
              <p className="mt-1 text-xs text-slate-500">Informasi, jadwal, dan kehadiran tim</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari nama, kontak, atau peran..."
                  className="min-h-10 w-full border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20 sm:w-56"
                />
              </label>
              <label className="relative block">
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="min-h-10 w-full appearance-none border border-slate-300 bg-white py-2 pl-3 pr-9 text-sm text-slate-600 outline-none focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20 sm:w-36"
                  aria-label="Filter berdasarkan status"
                >
                  <option>Semua status</option>
                  <option>Aktif</option>
                  <option>Cuti</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </label>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-180 text-left text-sm">
              <thead className="border-b border-slate-300 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-5 py-3.5">Pegawai</th>
                  <th className="px-4 py-3.5">Peran</th>
                  <th className="px-4 py-3.5">Jadwal hari ini</th>
                  <th className="px-4 py-3.5">Kehadiran</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {isLoading ? (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">Memuat data pegawai...</td></tr>
                ) : filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="transition hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center border border-slate-200 text-xs font-semibold ${employee.color}`}>{employee.initials}</span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">{employee.name}</p>
                          <div className="mt-1 space-y-0.5">
                            <p className="flex items-center gap-1 truncate text-xs text-slate-500"><Mail className="h-3 w-3 shrink-0" />{employee.email}</p>
                            <p className="flex items-center gap-1 truncate text-xs text-slate-500"><Phone className="h-3 w-3 shrink-0" />{employee.phone}</p>
                            <p className="truncate text-xs text-slate-500">Login: {employee.loginUsername || 'Belum tersedia'}</p>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">{employee.role}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">{employee.shift || '—'}</td>
                    <td className="px-4 py-4">
                      <div>
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${!employee.clockIn ? 'text-slate-500' : employee.attendance === 'Terlambat' ? 'text-amber-700' : 'text-emerald-700'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${!employee.clockIn ? 'bg-slate-300' : employee.attendance === 'Terlambat' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                          {!employee.clockIn ? 'Belum clock-in' : employee.attendance}
                        </span>
                        {employee.clockIn && <p className="mt-1 text-[10px] text-slate-500">Masuk {formatClock(employee.clockIn)}{employee.clockOut ? ` · Keluar ${formatClock(employee.clockOut)}` : ''}</p>}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${employee.status === 'Aktif' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {employee.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">

                        <button type="button" onClick={() => openEditModal(employee)} className="p-2 text-slate-400 transition-colors hover:bg-green-50 hover:text-[#16852B]" aria-label={`Edit ${employee.name}`} title="Edit pegawai">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => handleDeleteEmployee(employee)} disabled={deletingEmployeeId === employee.id} className="p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40" aria-label={`Hapus ${employee.name}`} title="Hapus pegawai">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!isLoading && filteredEmployees.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center">
                      <Users className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-3 text-sm font-medium text-slate-700">{employees.length === 0 ? 'Belum ada pegawai' : 'Pegawai tidak ditemukan'}</p>
                      <p className="mt-1 text-xs text-slate-500">{employees.length === 0 ? 'Tambahkan pegawai untuk mulai mengelola tim cabang.' : 'Coba ubah kata kunci atau filter status.'}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-300 px-4 py-3 text-xs text-slate-500">
            <span>Menampilkan <span className="font-medium text-slate-700">{filteredEmployees.length}</span> dari {employees.length} pegawai</span>
            <span>Data cabang</span>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="border border-slate-300 bg-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">Jadwal hari ini</h2>
                <p className="mt-1 text-xs text-slate-500">{scheduledEmployees.length} pegawai terjadwal</p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center bg-emerald-50 text-emerald-700"><CalendarDays className="h-4 w-4" /></span>
            </div>
            {scheduledEmployees.length > 0 ? (
              <div className="mt-5 space-y-4">
                {scheduledEmployees.map((employee, index) => {
                  const attendanceTone = !employee.clockIn
                    ? 'bg-slate-300'
                    : employee.attendance === 'Terlambat'
                      ? 'bg-amber-400'
                      : 'bg-emerald-500';
                  const attendanceLabel = !employee.clockIn
                    ? 'Belum clock-in'
                    : `${employee.attendance} · Masuk ${formatClock(employee.clockIn)}${employee.clockOut ? ` · Keluar ${formatClock(employee.clockOut)}` : ''}`;
                  const attendanceTextTone = !employee.clockIn
                    ? 'text-slate-400'
                    : employee.attendance === 'Terlambat'
                      ? 'text-amber-600'
                      : 'text-emerald-700';

                  return (
                    <div key={employee.id} className="flex gap-3">
                      <div className="flex w-3 flex-col items-center">
                        <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${attendanceTone}`} />
                        {index < scheduledEmployees.length - 1 && <span className="mt-1 w-px flex-1 bg-slate-100" />}
                      </div>
                      <div className="flex min-w-0 flex-1 items-start justify-between gap-2 pb-1">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center border border-slate-200 text-[10px] font-semibold ${employee.color}`}>{employee.initials}</span>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-800">{employee.name}</p>
                            <p className="mt-0.5 truncate text-[11px] text-slate-500">{employee.role}</p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[11px] font-medium text-slate-700">{employee.shift}</p>
                          <p className={`mt-0.5 text-[10px] ${attendanceTextTone}`}>{attendanceLabel}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 border border-slate-200 bg-slate-50 px-4 py-6 text-center">
                <CalendarDays className="mx-auto h-6 w-6 text-slate-300" />
                <p className="mt-2 text-xs text-slate-500">Belum ada pegawai aktif yang dijadwalkan hari ini.</p>
              </div>
            )}
          </section>

          <section className="border border-slate-300 bg-white p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-emerald-50 text-emerald-700"><Clock3 className="h-4 w-4" /></span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Ringkasan kehadiran</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">Catatan disimpan per tanggal WIB. Kelola clock-in dan clock-out melalui menu Presensi.</p>
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between border-t border-slate-200 pt-4">
              <div>
                <p className="text-2xl font-semibold tracking-tight text-slate-900">{attendanceRate}%</p>
                <p className="mt-0.5 text-xs text-slate-500">sudah mengisi kehadiran</p>
              </div>
              <span className="border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">{checkedInCount} dari {scheduledEmployees.length}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 border-t border-slate-200 pt-3 text-center">
              <div><p className="text-sm font-semibold text-emerald-700">{presentCount}</p><p className="mt-0.5 text-[10px] text-slate-500">Hadir</p></div>
              <div><p className="text-sm font-semibold text-amber-600">{lateCount}</p><p className="mt-0.5 text-[10px] text-slate-500">Terlambat</p></div>
              <div><p className="text-sm font-semibold text-slate-600">{notArrivedCount}</p><p className="mt-0.5 text-[10px] text-slate-500">Belum masuk</p></div>
            </div>
          </section>
        </aside>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/40" onClick={() => !isSubmitting && setIsModalOpen(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-dialog-title"
            className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden border border-slate-300 bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-300 p-5">
              <div>
                <h2 id="employee-dialog-title" className="text-lg font-semibold text-slate-900">{editingEmployee ? 'Edit pegawai' : 'Tambah pegawai'}</h2>
                <p className="mt-1 text-sm text-slate-500">Atur profil, status kerja, dan jadwal pegawai.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="inline-flex h-10 w-10 items-center justify-center text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#21AC3A] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Tutup dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEmployee} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                {formError && <p role="alert" className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
                <label className="block text-sm font-semibold text-slate-700">Nama lengkap
                  <input required autoFocus value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Contoh: Nadia Putri" className="mt-1.5 min-h-11 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none transition-colors focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">Email
                  <input required type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="nama@email.com" className="mt-1.5 min-h-11 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none transition-colors focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">Nomor telepon
                  <input required type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="0812-3456-7890" className="mt-1.5 min-h-11 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none transition-colors focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">Peran
                  <select disabled={isEditingOwnManagerRole} value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))} className="mt-1.5 min-h-11 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none transition-colors focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500">
                    <option>Kasir</option><option>Staf Gudang</option><option>Manajer Toko</option>
                  </select>
                  <p className="mt-1 text-xs font-normal text-slate-500">
                    {isEditingOwnManagerRole
                      ? 'Peran Manajer Toko pada akun Anda tidak dapat diubah sendiri.'
                      : 'Kasir mengakses POS, Staf Gudang mengakses Inventori & Stok, dan Manajer Toko mengakses EMS, CRS, serta Presensi.'}
                  </p>
                </label>
                <label className="block text-sm font-semibold text-slate-700">Jadwal hari ini
                  <input value={form.shift} onChange={(event) => setForm((current) => ({ ...current, shift: event.target.value }))} placeholder="08.00 – 16.00 (kosongkan jika tidak dijadwalkan)" className="mt-1.5 min-h-11 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none transition-colors focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20" />
                  <p className="mt-1 text-xs font-normal text-slate-500">Clock-in setelah jam mulai shift akan ditandai terlambat.</p>
                </label>
                <label className="block text-sm font-semibold text-slate-700">Status kerja
                  <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as EmployeeStatus }))} className="mt-1.5 min-h-11 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none transition-colors focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20">
                    <option>Aktif</option><option>Cuti</option>
                  </select>
                </label>
              </div>
              <div className="flex shrink-0 justify-end gap-3 border-t border-slate-300 bg-slate-50 p-4">
                <button type="button" disabled={isSubmitting} onClick={() => setIsModalOpen(false)} className="min-h-10 border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Batal</button>
                <button type="submit" disabled={isSubmitting} className="inline-flex min-h-10 items-center gap-2 border border-[#21AC3A] bg-[#21AC3A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1d9732] disabled:cursor-not-allowed disabled:opacity-60">
                  {isSubmitting ? <Clock3 className="h-4 w-4 animate-spin" /> : editingEmployee ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {isSubmitting ? 'Menyimpan...' : editingEmployee ? 'Simpan perubahan' : 'Simpan pegawai'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
