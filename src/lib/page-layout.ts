export function isFullWidthPage(pathname: string) {
  return /^\/sessions\/[^/]+\/tracks\/[^/]+$/.test(pathname);
}

/** Full main width so a left track nav can sit beside the app sidebar; page content stays constrained. */
export function isSplitNavPage(pathname: string) {
  return /^\/sessions\/[^/]+\/review$/.test(pathname);
}