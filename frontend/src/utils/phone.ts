const indonesianMobilePhone = /^(?:\+62|62|0)8[1-9]\d{7,10}$/;

export function isValidIndonesianMobilePhone(phone: string): boolean {
  const normalized = phone.trim().replace(/[\s()-]/g, '');
  return indonesianMobilePhone.test(normalized);
}
