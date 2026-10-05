/**
 * Maps utility for Recall.
 * Formats proper deep links for Google Maps & Apple Maps.
 * Automatically chooses Apple Maps on iOS/macOS or defaults to Google Maps.
 */

export function getMapsDirectionsUrl(
  location: string,
  preference: 'auto' | 'apple' | 'google' = 'auto'
): string {
  const encoded = encodeURIComponent(location.trim());

  if (preference === 'apple') {
    return `http://maps.apple.com/?daddr=${encoded}`;
  }

  if (preference === 'google') {
    return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
  }

  // Automatic detection in browser
  if (typeof navigator !== 'undefined') {
    const isApple = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
    if (isApple) {
      return `http://maps.apple.com/?daddr=${encoded}`;
    }
  }

  return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
}
