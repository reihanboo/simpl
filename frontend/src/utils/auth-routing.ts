export async function getAuthenticatedDestination(token: string): Promise<string> {
  try {
    const response = await fetch('/api/business', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return '/dashboard';
    }

    const data: { businesses?: unknown[] | null } = await response.json();
    return Array.isArray(data.businesses) && data.businesses.length > 0
      ? '/dashboard'
      : '/onboarding';
  } catch {
    return '/dashboard';
  }
}
