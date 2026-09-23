/**
 * Single source of truth for provider-specific language identifiers.
 * Nothing outside this file should hardcode a Judge0 language id or a
 * JDoodle `language`/`versionIndex` pair — both providers key off Compile
 * Palace's own `languageOptions` (compileService.ts) via `judge0Id`.
 *
 * JDoodle versionIndex values verified against jdoodle.com/docs/api/languages
 * (fetched live, not guessed) and pinned to whichever entry sits closest to
 * the version Compile Palace's existing Judge0 config already uses for that
 * language — not "latest", per the brief's explicit instruction not to rely
 * on an arbitrary/newest index.
 */
export interface JDoodleLanguageMapping {
  language: string;
  versionIndex: string;
}

interface LanguageMapping {
  /** Judge0 language id — same ids as compileService.ts's languageOptions. */
  judge0Id: number;
  /** Judge0's own version string, kept here only as the comment-level reason for the JDoodle pin above. */
  judge0Version: string;
  jdoodle: JDoodleLanguageMapping | null; // null = no valid mapping, fallback must report PROVIDER_UNAVAILABLE/unsupported, never guess.
}

export const LANGUAGE_MAPPINGS: LanguageMapping[] = [
  { judge0Id: 63, judge0Version: "JavaScript (Node.js 12.14.0)", jdoodle: { language: "nodejs", versionIndex: "3" } }, // JDoodle nodejs#3 = 12.11.1
  { judge0Id: 71, judge0Version: "Python (3.8.1)", jdoodle: { language: "python3", versionIndex: "3" } }, // JDoodle python3#3 = 3.7.4
  { judge0Id: 62, judge0Version: "Java (OpenJDK 13.0.1)", jdoodle: { language: "java", versionIndex: "3" } }, // JDoodle java#3 = JDK 11.0.4
  { judge0Id: 54, judge0Version: "C++ (GCC 9.2.0)", jdoodle: { language: "cpp", versionIndex: "4" } }, // JDoodle cpp#4 = GCC 9.1.0
  { judge0Id: 50, judge0Version: "C (GCC 9.2.0)", jdoodle: { language: "c", versionIndex: "4" } }, // JDoodle c#4 = GCC 9.1.0
  { judge0Id: 51, judge0Version: "C# (Mono 6.6.0.161)", jdoodle: { language: "csharp", versionIndex: "4" } }, // JDoodle csharp#4 = mono 6.12.0
  { judge0Id: 68, judge0Version: "PHP (7.4.1)", jdoodle: { language: "php", versionIndex: "3" } }, // JDoodle php#3 = 7.3.10
  { judge0Id: 78, judge0Version: "Ruby (2.7.0)", jdoodle: { language: "ruby", versionIndex: "3" } }, // JDoodle ruby#3 = 2.6.5
  { judge0Id: 82, judge0Version: "SQL (SQLite 3.27.2)", jdoodle: { language: "sql", versionIndex: "3" } }, // JDoodle sql#3 = SQLite 3.29.0
  { judge0Id: 83, judge0Version: "Swift (5.1.3)", jdoodle: { language: "swift", versionIndex: "3" } }, // JDoodle swift#3 = 5.1
];

export function getJDoodleMapping(judge0Id: number): JDoodleLanguageMapping | null {
  return LANGUAGE_MAPPINGS.find((m) => m.judge0Id === judge0Id)?.jdoodle ?? null;
}
