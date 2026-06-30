export function isFullWidthPage(pathname: string) {
  return /^\/sessions\/[^/]+\/tracks\/[^/]+$/.test(pathname);
}
