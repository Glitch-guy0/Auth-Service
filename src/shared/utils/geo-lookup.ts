/**
 * Geo-lookup utility for IP-based location resolution.
 *
 * Phase 1: Returns placeholder values.
 * Future: Integrate MaxMind GeoLite2 database for real IP geolocation.
 */
export function geoLookup(_ip: string): { country: string; city: string } {
  return { country: 'unknown', city: 'unknown' };
}
