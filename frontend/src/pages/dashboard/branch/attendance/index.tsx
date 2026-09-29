import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LocateFixed,
  LogIn,
  LogOut,
  MapPin,
  Users,
} from 'lucide-react';

type AttendanceStatus = 'Hadir' | 'Terlambat' | 'Belum masuk';

interface EmployeeAttendanceRecord {
  id: string;
  name: string;
  role: string;
  status: 'Aktif' | 'Cuti';
  shift: string;
  attendance_status: AttendanceStatus;
  clock_in: string | null;
  clock_out: string | null;
  clock_in_accuracy_m: number | null;
  clock_out_accuracy_m: number | null;
  clock_in_latitude: number | null;
  clock_in_longitude: number | null;
  clock_out_latitude: number | null;
  clock_out_longitude: number | null;
}

interface EmployeeAttendance {
  id: string;
  name: string;
  role: string;
  status: 'Aktif' | 'Cuti';
  shift: string;
  attendanceStatus: AttendanceStatus;
  clockIn: string | null;
  clockOut: string | null;
  clockInAccuracyM: number | null;
  clockOutAccuracyM: number | null;
  clockInLatitude: number | null;
  clockInLongitude: number | null;
  clockOutLatitude: number | null;
  clockOutLongitude: number | null;
}

interface BranchLocation {
  latitude: number | null;
  longitude: number | null;
  geofence_radius_m: number;
}

const todayLabel = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(new Date());

function formatClock(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function mapAttendance(record: EmployeeAttendanceRecord): EmployeeAttendance {
  return {
    id: record.id,
    name: record.name,
    role: record.role,
    status: record.status,
    shift: record.shift,
    attendanceStatus: record.attendance_status,
    clockIn: record.clock_in,
    clockOut: record.clock_out,
    clockInAccuracyM: record.clock_in_accuracy_m,
    clockOutAccuracyM: record.clock_out_accuracy_m,
    clockInLatitude: record.clock_in_latitude,
    clockInLongitude: record.clock_in_longitude,
    clockOutLatitude: record.clock_out_latitude,
    clockOutLongitude: record.clock_out_longitude,
  };
}

function getCurrentLocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Perangkat ini tidak mendukung layanan lokasi.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error('Izin lokasi ditolak. Izinkan akses lokasi di browser untuk mencatat presensi.'));
        } else if (error.code === error.TIMEOUT) {
          reject(new Error('Pencarian lokasi melewati batas waktu. Coba lagi di area dengan sinyal GPS yang lebih baik.'));
        } else {
          reject(new Error('Lokasi perangkat tidak tersedia. Pastikan GPS aktif lalu coba lagi.'));
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

export default function AttendanceIndex() {
  const { id: branchId } = useParams();
  const [employees, setEmployees] = useState<EmployeeAttendance[]>([]);
  const [branch, setBranch] = useState<BranchLocation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [workingEmployeeId, setWorkingEmployeeId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!branchId) return;
    const controller = new AbortController();

    const loadAttendance = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const response = await fetch(`/api/branches/${branchId}/employees`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Gagal memuat presensi pegawai.');
        setEmployees(((payload.data || []) as EmployeeAttendanceRecord[]).map(mapAttendance));
        setBranch((payload.branch || null) as BranchLocation | null);
        setError('');
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Gagal memuat presensi pegawai.');
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void loadAttendance();
    return () => controller.abort();
  }, [branchId]);

  const scheduledEmployees = useMemo(() => employees
    .filter((employee) => employee.status === 'Aktif' && employee.shift.trim() !== '' && employee.shift !== '—')
    .sort((first, second) => first.shift.localeCompare(second.shift, 'id-ID')), [employees]);
  const checkedInCount = scheduledEmployees.filter((employee) => employee.clockIn).length;
  const presentCount = scheduledEmployees.filter((employee) => employee.clockIn && employee.attendanceStatus === 'Hadir').length;
  const lateCount = scheduledEmployees.filter((employee) => employee.clockIn && employee.attendanceStatus === 'Terlambat').length;
  const geofenceReady = branch?.latitude != null && branch.longitude != null && branch.geofence_radius_m > 0;

  const handlePunch = async (employee: EmployeeAttendance, action: 'clock-in' | 'clock-out') => {
    if (!branchId) return;
    setWorkingEmployeeId(employee.id);
    setError('');
    setNotice('');
    try {
      const position = await getCurrentLocation();
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`/api/branches/${branchId}/employees/${employee.id}/attendance/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy_m: position.coords.accuracy,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Gagal mencatat presensi.');
      const attendance = payload.attendance as {
        status: AttendanceStatus;
        clock_in: string | null;
        clock_out: string | null;
        clock_in_accuracy_m: number | null;
        clock_out_accuracy_m: number | null;
        clock_in_latitude: number | null;
        clock_in_longitude: number | null;
        clock_out_latitude: number | null;
        clock_out_longitude: number | null;
      };
      setEmployees((current) => current.map((item) => item.id === employee.id
        ? {
          ...item,
          attendanceStatus: attendance.status,
          clockIn: attendance.clock_in,
          clockOut: attendance.clock_out,
          clockInAccuracyM: attendance.clock_in_accuracy_m,
          clockOutAccuracyM: attendance.clock_out_accuracy_m,
          clockInLatitude: attendance.clock_in_latitude,
          clockInLongitude: attendance.clock_in_longitude,
          clockOutLatitude: attendance.clock_out_latitude,
          clockOutLongitude: attendance.clock_out_longitude,
        }
        : item));
      setNotice(`${action === 'clock-in' ? 'Clock-in' : 'Clock-out'} ${employee.name} berhasil dicatat.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal mencatat presensi.');
    } finally {
      setWorkingEmployeeId(null);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-400">
            <span>Operasional</span><span>/</span><span className="text-slate-600">Presensi</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Presensi pegawai</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span>Clock-in dan clock-out dengan verifikasi lokasi cabang.</span>
            <span className="inline-flex items-center gap-1.5 text-xs capitalize text-slate-400"><CalendarDays className="h-3.5 w-3.5" />{todayLabel}</span>
          </div>
        </div>
      </header>

      <div className="flex gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <p><span className="font-semibold">Presensi dibantu pengelola.</span> Saat ini akun pegawai dan login mandiri belum tersedia. Lokasi perangkat pengelola diverifikasi untuk setiap pencatatan; fitur ini belum membuktikan bahwa perangkat tersebut dipegang oleh pegawai yang bersangkutan.</p>
      </div>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Pegawai terjadwal', value: String(scheduledEmployees.length), icon: <Users className="h-5 w-5" />, tone: 'bg-sky-50 text-sky-700' },
          { label: 'Sudah clock-in', value: `${checkedInCount} / ${scheduledEmployees.length}`, icon: <CheckCircle2 className="h-5 w-5" />, tone: 'bg-emerald-50 text-emerald-700' },
          { label: 'Hadir tepat waktu', value: String(presentCount), icon: <Clock3 className="h-5 w-5" />, tone: 'bg-violet-50 text-violet-700' },
          { label: 'Terlambat', value: String(lateCount), icon: <AlertCircle className="h-5 w-5" />, tone: 'bg-amber-50 text-amber-700' },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/2">
            <div><p className="text-sm font-medium text-slate-500">{item.label}</p><p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p></div>
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.tone}`}>{item.icon}</span>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/2">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${geofenceReady ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}><MapPin className="h-5 w-5" /></span>
            <div>
              <h2 className="font-semibold text-slate-900">Area presensi cabang</h2>
              {geofenceReady ? (
                <p className="mt-1 text-sm text-slate-500">Radius {branch.geofence_radius_m} m · {branch.latitude?.toFixed(6)}, {branch.longitude?.toFixed(6)}</p>
              ) : (
                <div>
                  <p className="mt-1 text-sm text-amber-700">Lokasi cabang belum diatur. Atur titik dan radius geofence melalui daftar cabang sebelum clock-in/out.</p>
                  <Link to="/dashboard" className="mt-2 inline-flex text-sm font-semibold text-emerald-700 hover:underline">Buka daftar cabang</Link>
                </div>
              )}
            </div>
          </div>
          {geofenceReady && (
            <a className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800" href={`https://www.google.com/maps?q=${branch.latitude},${branch.longitude}`} target="_blank" rel="noreferrer">
              <LocateFixed className="h-4 w-4" />Lihat peta
            </a>
          )}
        </div>
        {geofenceReady && <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">Setiap clock-in dan clock-out memerlukan akurasi GPS maksimal 100 m dan divalidasi terhadap radius ini oleh server.</p>}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/2">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-semibold text-slate-900">Jadwal hari ini</h2>
          <p className="mt-1 text-xs text-slate-500">Status dan waktu presensi aktual untuk pegawai aktif yang memiliki shift.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-190 text-left">
            <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-3.5">Pegawai</th><th className="px-4 py-3.5">Shift</th><th className="px-4 py-3.5">Clock-in</th><th className="px-4 py-3.5">Clock-out</th><th className="px-4 py-3.5">Status</th><th className="px-5 py-3.5 text-right">Aksi</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">Memuat presensi...</td></tr>
              ) : scheduledEmployees.map((employee) => {
                const hasClockedIn = Boolean(employee.clockIn);
                const hasClockedOut = Boolean(employee.clockOut);
                const accuracy = hasClockedOut ? employee.clockOutAccuracyM : employee.clockInAccuracyM;
                const latitude = hasClockedOut ? employee.clockOutLatitude : employee.clockInLatitude;
                const longitude = hasClockedOut ? employee.clockOutLongitude : employee.clockInLongitude;
                return (
                  <tr key={employee.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-4"><p className="text-sm font-semibold text-slate-800">{employee.name}</p><p className="mt-1 text-xs text-slate-500">{employee.role}</p></td>
                    <td className="px-4 py-4 text-sm text-slate-600">{employee.shift}</td>
                    <td className="px-4 py-4 text-sm text-slate-700">{formatClock(employee.clockIn)}</td>
                    <td className="px-4 py-4 text-sm text-slate-700">{formatClock(employee.clockOut)}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${!hasClockedIn ? 'text-slate-500' : employee.attendanceStatus === 'Terlambat' ? 'text-amber-700' : 'text-emerald-700'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${!hasClockedIn ? 'bg-slate-300' : employee.attendanceStatus === 'Terlambat' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                        {!hasClockedIn ? 'Belum masuk' : employee.attendanceStatus}
                      </span>
                      {accuracy != null && <p className="mt-1 text-[10px] text-slate-400">Akurasi GPS ±{Math.round(accuracy)} m</p>}
                      {latitude != null && longitude != null && <a className="mt-1 inline-block text-[10px] font-medium text-emerald-700 hover:underline" href={`https://www.google.com/maps?q=${latitude},${longitude}`} target="_blank" rel="noreferrer">Lihat lokasi rekaman</a>}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {!hasClockedIn ? (
                        <button type="button" onClick={() => void handlePunch(employee, 'clock-in')} disabled={!geofenceReady || workingEmployeeId === employee.id} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40">
                          <LogIn className="h-3.5 w-3.5" />{workingEmployeeId === employee.id ? 'Memproses...' : 'Clock-in'}
                        </button>
                      ) : !hasClockedOut ? (
                        <button type="button" onClick={() => void handlePunch(employee, 'clock-out')} disabled={!geofenceReady || workingEmployeeId === employee.id} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40">
                          <LogOut className="h-3.5 w-3.5" />{workingEmployeeId === employee.id ? 'Memproses...' : 'Clock-out'}
                        </button>
                      ) : <span className="text-xs font-medium text-slate-400">Selesai</span>}
                    </td>
                  </tr>
                );
              })}
              {!isLoading && scheduledEmployees.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-12 text-center"><Users className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-medium text-slate-700">Belum ada pegawai terjadwal</p><p className="mt-1 text-xs text-slate-500">Tambahkan pegawai aktif dan isi shift pada menu Pegawai.</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
