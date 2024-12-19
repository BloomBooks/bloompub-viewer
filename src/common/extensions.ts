export const validExtensions = [
  ".bloomd",
  ".bloompub",
  ".bloom",
  ".bloomsource",
];
export function hasValidExtension(filePath: string): boolean {
  return validExtensions.some((ext) =>
    filePath.toLowerCase().endsWith(ext.toLowerCase())
  );
}
