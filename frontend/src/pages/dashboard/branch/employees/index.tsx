import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { motion } from 'framer-motion';
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

interface Employee {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: EmployeeStatus;
  attendance: AttendanceStatus;
  shift: string;
  initials: string;
  color: string;
}

interface EmployeeForm {
  name: string;
  email: string;
  phone: string;
  role: string;
  status: EmployeeStatus;
  attendance: AttendanceStatus;
  shift: string;
}

const emptyForm: EmployeeForm = {
  name: '',
  email: '',
  phone: '',
  role: 'Kasir',
  status: 'Aktif',
  attendance: 'Belum masuk',
  shift: '',
};

const initialEmployees: Employee[] = [
  { id: 1, name: 'Aulia Rahma', email: 'aulia.rahma@simpl.id', phone: '0812-3456-7890', role: 'Manajer Toko', status: 'Aktif', attendance: 'Hadir', shift: '08.00 – 16.00', initials: 'AR', color: 'bg-violet-100 text-violet-700' },
  { id: 2, name: 'Bima Pratama', email: 'bima.pratama@simpl.id', phone: '0813-4567-8901', role: 'Kasir', status: 'Aktif', attendance: 'Hadir', shift: '08.00 – 16.00', initials: 'BP', color: 'bg-sky-100 text-sky-700' },
  { id: 3, name: 'Citra Lestari', email: 'citra.lestari@simpl.id', phone: '0812-5678-9012', role: 'Kasir', status: 'Aktif', attendance: 'Terlambat', shift: '09.00 – 17.00', initials: 'CL', color: 'bg-rose-100 text-rose-700' },
  { id: 4, name: 'Dimas Saputra', email: 'dimas.saputra@simpl.id', phone: '0815-6789-0123', role: 'Staf Gudang', status: 'Aktif', attendance: 'Hadir', shift: '08.00 – 16.00', initials: 'DS', color: 'bg-amber-100 text-amber-700' },
  { id: 5, name: 'Intan Permata', email: 'intan.permata@simpl.id', phone: '0813-7890-1234', role: 'Kasir', status: 'Cuti', attendance: 'Belum masuk', shift: '—', initials: 'IP', color: 'bg-pink-100 text-pink-700' },
  { id: 6, name: 'Rizky Maulana', email: 'rizky.maulana@simpl.id', phone: '0812-8901-2345', role: 'Staf Gudang', status: 'Aktif', attendance: 'Belum masuk', shift: '12.00 – 20.00', initials: 'RM', color: 'bg-indigo-100 text-indigo-700' },
];

const avatarColors = [
  'bg-emerald-100 text-emerald-700',
  'bg-orange-100 text-orange-700',
  'bg-cyan-100 text-cyan-700',
  'bg-fuchsia-100 text-fuchsia-700',
];

const todayLabel = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(new Date());

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>{icon}</span>
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
  const [employees, setEmployees] = useState(initialEmployees);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua status');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);

  const filteredEmployees = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('id-ID');
    return employees.filter((employee) => {
      const matchesQuery = !normalizedQuery ||
        employee.name.toLocaleLowerCase('id-ID').includes(normalizedQuery) ||
        employee.email.toLocaleLowerCase('id-ID').includes(normalizedQuery) ||
        employee.phone.toLocaleLowerCase('id-ID').includes(normalizedQuery) ||
        employee.role.toLocaleLowerCase('id-ID').includes(normalizedQuery);
      const matchesStatus = statusFilter === 'Semua status' || employee.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [employees, query, statusFilter]);

  const activeEmployees = employees.filter((employee) => employee.status === 'Aktif');
  const scheduledEmployees = activeEmployees
    .filter((employee) => employee.shift.trim() !== '' && employee.shift !== '—')
    .sort((first, second) => first.shift.localeCompare(second.shift, 'id-ID'));
  const presentCount = scheduledEmployees.filter((employee) => employee.attendance === 'Hadir').length;
  const lateCount = scheduledEmployees.filter((employee) => employee.attendance === 'Terlambat').length;
  const checkedInCount = presentCount + lateCount;
  const notArrivedCount = scheduledEmployees.length - checkedInCount;
  const attendanceRate = scheduledEmployees.length
    ? Math.round((checkedInCount / scheduledEmployees.length) * 100)
    : 0;

  const openAddModal = () => {
    setEditingEmployee(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = (employee: Employee) => {
    setEditingEmployee(employee);
    setForm({
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      role: employee.role,
      status: employee.status,
      attendance: employee.attendance,
      shift: employee.shift === '—' ? '' : employee.shift,
    });
    setIsModalOpen(true);
  };

  const handleSaveEmployee = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const employeeFields = {
      ...form,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      shift: form.shift.trim() || '—',
      initials: getInitials(form.name),
    };

    if (editingEmployee) {
      setEmployees((current) => current.map((employee) => employee.id === editingEmployee.id
        ? { ...employee, ...employeeFields }
        : employee));
    } else {
      setEmployees((current) => [
        ...current,
        {
          id: Date.now(),
          ...employeeFields,
          color: avatarColors[current.length % avatarColors.length],
        },
      ]);
    }

    setIsModalOpen(false);
    setEditingEmployee(null);
    setForm(emptyForm);
  };

  const handleDeleteEmployee = (employee: Employee) => {
    if (!window.confirm(`Hapus ${employee.name} dari daftar pegawai?`)) return;
    setEmployees((current) => current.filter((item) => item.id !== employee.id));
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-400">
            <span>Operasional</span><span>/</span><span className="text-slate-600">Pegawai</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Manajemen Pegawai</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span>Kelola tim, jadwal kerja, dan kehadiran dalam satu tempat.</span>
            <span className="inline-flex items-center gap-1.5 text-xs capitalize text-slate-400">
              <CalendarDays className="h-3.5 w-3.5" />{todayLabel}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#21AC3A] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1B9331] focus:outline-none focus:ring-4 focus:ring-emerald-100"
        >
          <UserPlus className="h-4 w-4" />
          Tambah pegawai
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total pegawai" value={String(employees.length)} detail="Pegawai terdaftar" icon={<Users className="h-5 w-5" />} tone="bg-sky-50 text-sky-700" />
        <StatCard label="Pegawai aktif" value={String(activeEmployees.length)} detail="Berstatus aktif" icon={<UserRoundCheck className="h-5 w-5" />} tone="bg-emerald-50 text-emerald-700" trend="up" />
        <StatCard label="Hadir hari ini" value={`${presentCount} orang`} detail={`${lateCount} terlambat · ${notArrivedCount} belum masuk`} icon={<Check className="h-5 w-5" />} tone="bg-violet-50 text-violet-700" />
        <StatCard label="Terlambat" value={String(lateCount)} detail="Dari pegawai terjadwal" icon={<Clock3 className="h-5 w-5" />} tone="bg-amber-50 text-amber-700" trend="down" />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/2">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
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
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 sm:w-56"
                />
              </label>
              <label className="relative block">
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-9 text-sm text-slate-600 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 sm:w-36"
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
            <table className="w-full min-w-180 text-left">
              <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Pegawai</th>
                  <th className="px-4 py-3.5">Peran</th>
                  <th className="px-4 py-3.5">Jadwal hari ini</th>
                  <th className="px-4 py-3.5">Kehadiran</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="transition hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${employee.color}`}>{employee.initials}</span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">{employee.name}</p>
                          <div className="mt-1 space-y-0.5">
                            <p className="flex items-center gap-1 truncate text-xs text-slate-500"><Mail className="h-3 w-3 shrink-0" />{employee.email}</p>
                            <p className="flex items-center gap-1 truncate text-xs text-slate-500"><Phone className="h-3 w-3 shrink-0" />{employee.phone}</p>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">{employee.role}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">{employee.shift || '—'}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${employee.attendance === 'Hadir' ? 'text-emerald-700' : employee.attendance === 'Terlambat' ? 'text-amber-700' : 'text-slate-500'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${employee.attendance === 'Hadir' ? 'bg-emerald-500' : employee.attendance === 'Terlambat' ? 'bg-amber-500' : 'bg-slate-300'}`} />
                        {employee.attendance}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${employee.status === 'Aktif' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {employee.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => openEditModal(employee)} className="rounded-lg p-2 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-700" aria-label={`Edit ${employee.name}`} title="Edit pegawai">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => handleDeleteEmployee(employee)} className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" aria-label={`Hapus ${employee.name}`} title="Hapus pegawai">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredEmployees.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center">
                      <Users className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-3 text-sm font-medium text-slate-700">Pegawai tidak ditemukan</p>
                      <p className="mt-1 text-xs text-slate-500">Coba ubah kata kunci atau filter status.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3.5 text-xs text-slate-500">
            <span>Menampilkan <span className="font-medium text-slate-700">{filteredEmployees.length}</span> dari {employees.length} pegawai</span>
            <span>Data cabang</span>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/2">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">Jadwal hari ini</h2>
                <p className="mt-1 text-xs text-slate-500">{scheduledEmployees.length} pegawai terjadwal</p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><CalendarDays className="h-4 w-4" /></span>
            </div>
            {scheduledEmployees.length > 0 ? (
              <div className="mt-5 space-y-4">
                {scheduledEmployees.map((employee, index) => {
                  const attendanceTone = employee.attendance === 'Hadir'
                    ? 'bg-emerald-500'
                    : employee.attendance === 'Terlambat'
                      ? 'bg-amber-400'
                      : 'bg-slate-300';
                  const attendanceLabel = employee.attendance === 'Hadir'
                    ? 'Hadir'
                    : employee.attendance === 'Terlambat'
                      ? 'Terlambat'
                      : 'Belum masuk';
                  const attendanceTextTone = employee.attendance === 'Terlambat' ? 'text-amber-600' : 'text-slate-400';

                  return (
                    <div key={employee.id} className="flex gap-3">
                      <div className="flex w-3 flex-col items-center">
                        <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${attendanceTone}`} />
                        {index < scheduledEmployees.length - 1 && <span className="mt-1 w-px flex-1 bg-slate-100" />}
                      </div>
                      <div className="flex min-w-0 flex-1 items-start justify-between gap-2 pb-1">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${employee.color}`}>{employee.initials}</span>
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
              <div className="mt-5 rounded-xl bg-slate-50 px-4 py-6 text-center">
                <CalendarDays className="mx-auto h-6 w-6 text-slate-300" />
                <p className="mt-2 text-xs text-slate-500">Belum ada pegawai aktif yang dijadwalkan hari ini.</p>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-emerald-100 bg-linear-to-br from-emerald-50/80 to-white p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm"><Clock3 className="h-4 w-4" /></span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Ringkasan kehadiran</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">Berdasarkan jadwal dan status kehadiran pegawai aktif hari ini.</p>
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between border-t border-emerald-100 pt-4">
              <div>
                <p className="text-2xl font-semibold tracking-tight text-slate-900">{attendanceRate}%</p>
                <p className="mt-0.5 text-xs text-slate-500">sudah mengisi kehadiran</p>
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-700">{checkedInCount} dari {scheduledEmployees.length}</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-emerald-100 pt-3 text-center">
              <div><p className="text-sm font-semibold text-emerald-700">{presentCount}</p><p className="mt-0.5 text-[10px] text-slate-500">Hadir</p></div>
              <div><p className="text-sm font-semibold text-amber-600">{lateCount}</p><p className="mt-0.5 text-[10px] text-slate-500">Terlambat</p></div>
              <div><p className="text-sm font-semibold text-slate-600">{notArrivedCount}</p><p className="mt-0.5 text-[10px] text-slate-500">Belum masuk</p></div>
            </div>
          </section>
        </aside>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsModalOpen(false); }}>
          <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="my-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{editingEmployee ? 'Edit pegawai' : 'Tambah pegawai'}</h2>
                <p className="mt-1 text-sm text-slate-500">Atur informasi, jadwal, dan kehadiran pegawai.</p>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Tutup dialog"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSaveEmployee} className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-slate-700">Nama lengkap
                <input required autoFocus value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Contoh: Nadia Putri" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50" />
              </label>
              <label className="block text-sm font-medium text-slate-700">Email
                <input required type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="nama@email.com" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50" />
              </label>
              <label className="block text-sm font-medium text-slate-700">Nomor telepon
                <input required type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="0812-3456-7890" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50" />
              </label>
              <label className="block text-sm font-medium text-slate-700">Peran
                <select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50">
                  <option>Kasir</option><option>Staf Gudang</option><option>Manajer Toko</option><option>Admin</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">Jadwal hari ini
                <input value={form.shift} onChange={(event) => setForm((current) => ({ ...current, shift: event.target.value }))} placeholder="08.00 – 16.00 (kosongkan jika tidak dijadwalkan)" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-slate-700">Kehadiran
                  <select value={form.attendance} onChange={(event) => setForm((current) => ({ ...current, attendance: event.target.value as AttendanceStatus }))} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50">
                    <option>Hadir</option><option>Terlambat</option><option>Belum masuk</option>
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">Status
                  <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as EmployeeStatus }))} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50">
                    <option>Aktif</option><option>Cuti</option>
                  </select>
                </label>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100">Batal</button>
                <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-[#21AC3A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1B9331]">
                  {editingEmployee ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {editingEmployee ? 'Simpan perubahan' : 'Simpan pegawai'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
