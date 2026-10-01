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
import { getBestCurrentPosition, LocationCaptureError } from '../../../../utils/geolocation';

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
  timezone: string;
}

interface LocationDiagnostic {
  distance_m: number;
  geofence_radius_m: number;
  accuracy_m: number;
  branch_latitude: number;
  branch_longitude: number;
  device_latitude: number;
  device_longitude: number;
}

function formatClock(value: string | null, timezone: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: timezone,
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
  return getBestCurrentPosition().catch((cause: unknown) => {
    if (!(cause instanceof LocationCaptureError)) throw cause;
    if (cause.code === 'unsupported') {
      throw new Error('Perangkat ini tidak mendukung layanan lokasi.');
    }
    if (cause.code === 'permission-denied') {
      throw new Error('Izin lokasi ditolak. Izinkan akses lokasi di browser untuk mencatat presensi.');
    }
    if (cause.code === 'timeout') {
      throw new Error('Pencarian lokasi melewati batas waktu. Coba lagi di area dengan sinyal GPS yang lebih baik.');
    }
    throw new Error('Lokasi perangkat tidak tersedia. Pastikan GPS aktif lalu coba lagi.');
  });
}

export default function AttendanceIndex() {
  const { id: branchId } = useParams();
  const [employees, setEmployees] = useState<EmployeeAttendance[]>([]);
  const [branch, setBranch] = useState<BranchLocation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [workingEmployeeId, setWorkingEmployeeId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [locationDiagnostic, setLocationDiagnostic] = useState<LocationDiagnostic | null>(null);
  const [notice, setNotice] = useState('');
  const timezone = branch?.timezone || 'Asia/Jakarta';
  const todayLabel = new Intl.DateTimeFormat('id-ID', {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

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
      if (!branchId || !employee.id) {
        setError('ID cabang atau pegawai tidak valid. Muat ulang halaman lalu coba lagi.');
        return;
      }
      setWorkingEmployeeId(employee.id);
      setError('');
      setLocationDiagnostic(null);
      setNotice('');

      try {
        // 1. Get client position
        let position: GeolocationPosition;
        try {
          position = await getCurrentLocation();
        } catch (geoError) {
          // Handle client-side geolocation failure directly
          const errorMessage = geoError instanceof Error ? geoError.message : 'Gagal mendapatkan lokasi perangkat.';
          setError(errorMessage);
          return;
        }

        // 2. Call Attendance API
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const attendanceUrl = `/api/branches/${encodeURIComponent(branchId)}/employees/${encodeURIComponent(employee.id)}/attendance/${action}`;
        const response = await fetch(attendanceUrl, {
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

        // Check for diagnostic payload in snake_case or camelCase
        const diagnostic = payload.location_diagnostic || payload.locationDiagnostic;
        if (diagnostic) {
          setLocationDiagnostic(diagnostic as LocationDiagnostic);
        }

        if (!response.ok) {
          throw new Error(payload.error || 'Gagal mencatat presensi.');
        }

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

        setEmployees((current) =>
          current.map((item) =>
            item.id === employee.id
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
              : item
          )
        );
        setNotice(`${action === 'clock-in' ? 'Clock-in' : 'Clock-out'} ${employee.name} berhasil dicatat.`);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Gagal mencatat presensi.');
      } finally {
        setWorkingEmployeeId(null);
      }
    };

  return (
    <div className="space-y-6 pb-8">
      <header className="border-b border-slate-200 pb-4">
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="font-medium text-[#21AC3A]">SIMPL</span><span className="text-slate-400">/</span><span className="text-slate-500">Operasional</span><span className="text-slate-400">/</span><span className="text-slate-500">Presensi</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Presensi pegawai</h1>
        <p className="mt-1 text-sm text-slate-500">Clock-in dan clock-out dengan verifikasi lokasi cabang. <span className="ml-2 inline-flex items-center gap-1.5 text-xs capitalize text-slate-400"><CalendarDays className="h-3.5 w-3.5" />{todayLabel}</span></p>
      </header>

      <div className="flex gap-3 border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <p><span className="font-semibold">Presensi dibantu pengelola.</span> Saat ini akun pegawai dan login mandiri belum tersedia. Lokasi perangkat pengelola diverifikasi untuk setiap pencatatan; fitur ini belum membuktikan bahwa perangkat tersebut dipegang oleh pegawai yang bersangkutan.</p>
      </div>

      {error && <p role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {locationDiagnostic && (
        <section aria-label="Diagnostik lokasi presensi" className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <h2 className="font-semibold">Detail pemeriksaan lokasi</h2>
          <p className="mt-1">Jarak terukur {Math.round(locationDiagnostic.distance_m)} m · radius cabang {locationDiagnostic.geofence_radius_m} m · akurasi GPS ±{Math.round(locationDiagnostic.accuracy_m)} m.</p>
          <p className="mt-1 text-xs">Pin cabang: {locationDiagnostic.branch_latitude.toFixed(6)}, {locationDiagnostic.branch_longitude.toFixed(6)} · perangkat: {locationDiagnostic.device_latitude.toFixed(6)}, {locationDiagnostic.device_longitude.toFixed(6)}</p>
          <div className="mt-2 flex flex-wrap gap-4 text-xs font-semibold">
            <a className="underline" href={`https://www.google.com/maps?q=${locationDiagnostic.branch_latitude},${locationDiagnostic.branch_longitude}`} target="_blank" rel="noreferrer">Lihat pin cabang</a>
            <a className="underline" href={`https://www.google.com/maps?q=${locationDiagnostic.device_latitude},${locationDiagnostic.device_longitude}`} target="_blank" rel="noreferrer">Lihat lokasi perangkat</a>
          </div>
        </section>
      )}
      {notice && <p role="status" className="border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</p>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Pegawai terjadwal', value: String(scheduledEmployees.length), icon: <Users className="h-5 w-5" />, tone: 'bg-sky-50 text-sky-700' },
          { label: 'Sudah clock-in', value: `${checkedInCount} / ${scheduledEmployees.length}`, icon: <CheckCircle2 className="h-5 w-5" />, tone: 'bg-emerald-50 text-emerald-700' },
          { label: 'Hadir tepat waktu', value: String(presentCount), icon: <Clock3 className="h-5 w-5" />, tone: 'bg-violet-50 text-violet-700' },
          { label: 'Terlambat', value: String(lateCount), icon: <AlertCircle className="h-5 w-5" />, tone: 'bg-amber-50 text-amber-700' },
        ].map((item) => (
          <div key={item.label} className="flex min-h-24 items-center justify-between border border-slate-300 bg-white p-4">
            <div><p className="text-sm text-slate-600">{item.label}</p><p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{item.value}</p></div>
            <span className={`flex h-9 w-9 items-center justify-center ${item.tone}`}>{item.icon}</span>
          </div>
        ))}
      </section>

      <section className="border border-slate-300 bg-white p-4">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center ${geofenceReady ? 'bg-green-50 text-[#16852B]' : 'bg-amber-50 text-amber-700'}`}><MapPin className="h-5 w-5" /></span>
            <div>
              <h2 className="font-semibold text-slate-900">Area presensi cabang</h2>
              {geofenceReady ? (
                <p className="mt-1 text-sm text-slate-500">Radius {branch.geofence_radius_m} m · {branch.latitude?.toFixed(6)}, {branch.longitude?.toFixed(6)}</p>
              ) : (
                <div>
                  <p className="mt-1 text-sm text-amber-700">Lokasi cabang belum diatur. Atur titik dan radius geofence melalui daftar cabang sebelum clock-in/out.</p>
                  <Link to={branchId ? `/dashboard?editBranch=${encodeURIComponent(branchId)}` : '/dashboard'} className="mt-2 inline-flex text-sm font-semibold text-[#16852B] hover:underline">Atur lokasi cabang</Link>
                </div>
              )}
              <p className="mt-1 text-xs text-slate-500">Zona waktu cabang: {branch?.timezone || 'Asia/Jakarta'}</p>
            </div>
          </div>
          {geofenceReady && (
            <a className="inline-flex items-center gap-2 text-sm font-semibold text-[#16852B] hover:text-[#126c23]" href={`https://www.google.com/maps?q=${branch.latitude},${branch.longitude}`} target="_blank" rel="noreferrer">
              <LocateFixed className="h-4 w-4" />Lihat peta
            </a>
          )}
        </div>
        {geofenceReady && <p className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-500">Setiap clock-in dan clock-out memerlukan akurasi GPS maksimal 200 m; hingga 100 m ketidakpastian GPS diperhitungkan di batas radius oleh server.</p>}
      </section>

      <section className="overflow-hidden border border-slate-300 bg-white">
        <div className="border-b border-slate-300 px-4 py-3">
          <h2 className="font-semibold text-slate-900">Jadwal hari ini</h2>
          <p className="mt-1 text-xs text-slate-500">Status dan waktu presensi aktual untuk pegawai aktif yang memiliki shift.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-190 text-left text-sm">
            <thead className="border-b border-slate-300 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr><th className="px-5 py-3.5">Pegawai</th><th className="px-4 py-3.5">Shift</th><th className="px-4 py-3.5">Clock-in</th><th className="px-4 py-3.5">Clock-out</th><th className="px-4 py-3.5">Status</th><th className="px-5 py-3.5 text-right">Aksi</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
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
                    <td className="px-4 py-4 text-sm text-slate-700">{formatClock(employee.clockIn, timezone)}</td>
                    <td className="px-4 py-4 text-sm text-slate-700">{formatClock(employee.clockOut, timezone)}</td>
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
                        <button type="button" onClick={() => void handlePunch(employee, 'clock-in')} disabled={!geofenceReady || workingEmployeeId === employee.id} className="inline-flex min-h-9 items-center gap-1.5 border border-[#21AC3A] bg-[#21AC3A] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1d9732] disabled:cursor-not-allowed disabled:opacity-40">
                          <LogIn className="h-3.5 w-3.5" />{workingEmployeeId === employee.id ? 'Memproses...' : 'Clock-in'}
                        </button>
                      ) : !hasClockedOut ? (
                        <button type="button" onClick={() => void handlePunch(employee, 'clock-out')} disabled={!geofenceReady || workingEmployeeId === employee.id} className="inline-flex min-h-9 items-center gap-1.5 border border-amber-600 bg-amber-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40">
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
