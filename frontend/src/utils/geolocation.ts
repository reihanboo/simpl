export type LocationCaptureErrorCode = 'unsupported' | 'permission-denied' | 'timeout' | 'unavailable';

export class LocationCaptureError extends Error {
  readonly code: LocationCaptureErrorCode;

  constructor(code: LocationCaptureErrorCode) {
    super(code);
    this.name = 'LocationCaptureError';
    this.code = code;
  }
}

export function getBestCurrentPosition(
  timeoutMs = 15000,
  targetAccuracyM = 50,
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new LocationCaptureError('unsupported'));
      return;
    }

    let watchId: number | null = null;
    let bestPosition: GeolocationPosition | null = null;
    let goodAccuracySamples = 0;
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const finish = (position?: GeolocationPosition, error?: LocationCaptureError) => {
      if (settled) return;
      settled = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      if (timeoutId != null) clearTimeout(timeoutId);
      if (position) resolve(position);
      else reject(error || new LocationCaptureError('unavailable'));
    };

    timeoutId = setTimeout(() => {
      if (bestPosition) finish(bestPosition);
      else finish(undefined, new LocationCaptureError('timeout'));
    }, timeoutMs);

    try {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
            bestPosition = position;
          }
          if (position.coords.accuracy <= targetAccuracyM) {
            goodAccuracySamples += 1;
          } else {
            goodAccuracySamples = 0;
          }
          if (position.coords.accuracy <= 15 || goodAccuracySamples >= 2) finish(bestPosition);
        },
        (error) => {
          if (bestPosition) {
            finish(bestPosition);
          } else if (error.code === error.PERMISSION_DENIED) {
            finish(undefined, new LocationCaptureError('permission-denied'));
          } else if (error.code === error.TIMEOUT) {
            finish(undefined, new LocationCaptureError('timeout'));
          } else {
            finish(undefined, new LocationCaptureError('unavailable'));
          }
        },
        { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
      );
    } catch {
      finish(undefined, new LocationCaptureError('unavailable'));
    }
  });
}
