/**
 * Extract the main language name without version information
 * @param fullName The full language name (e.g., "JavaScript (Node.js 12.14.0)")
 * @returns The clean language name (e.g., "JavaScript")
 */
export const getCleanLanguageName = (fullName: string): string => {
  if (!fullName) return 'Unknown';
  
  // Remove anything in parentheses and trim
  const cleanName = fullName.split('(')[0].trim();
  
  // If the name has additional info after a space, keep only the first part
  return cleanName.split(' ')[0];
};
