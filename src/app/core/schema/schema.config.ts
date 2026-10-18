export const SCHEMA_CONFIG = {
  baseUrl: 'https://www.banglabazarbooks.com',
  organizationId: 'https://www.banglabazarbooks.com/#organization',
  websiteId: 'https://www.banglabazarbooks.com/#website',
  localBusinessId: 'https://www.banglabazarbooks.com/#localbusiness',
  name: 'Banglabazar Books',
  alternateName: 'বাংলা বাজার বুকস্স',
  foundingDate: '2017',
  description: 'A creative book publishing house in Bangladesh.',
  logo: 'https://www.banglabazarbooks.com/images/logo/banglabazar-books-logo.png',
  email: 'Banglabazarbooks@gmail.com',
  phones: ['+8801710197558', '+8801998584958'],
  landline: '+8802557163214',
  /** Default LocalBusiness until client confirms retail BookStore at Banglabazar. */
  localBusinessType: 'LocalBusiness' as 'LocalBusiness' | 'BookStore',
  address: {
    streetAddress: '34 Northbrook Hall Road (2nd Floor), Banglabazar',
    addressLocality: 'Dhaka',
    postalCode: '1100',
    addressCountry: 'BD',
  },
  sameAs: [
    'https://www.facebook.com/Banglabazarbooks/',
    'https://www.youtube.com/@Guardianpublication',
  ],
  inLanguage: ['bn-BD', 'en'],
} as const;

export function absoluteUrl(path: string): string {
  if (!path) {
    return SCHEMA_CONFIG.baseUrl;
  }
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${SCHEMA_CONFIG.baseUrl}${normalized}`;
}
