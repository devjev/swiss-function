/** A small syntax highlighter for fenced code in Markdown's terminal reading.
 *
 *  It splits code into tokens by the surface rules most languages share
 *  (comments, strings, keywords, the names before a call, capitalised type
 *  names, punctuation), with one profile per language family. It knows no
 *  grammar, so it is for reading code in a reply, not for editing it: the
 *  `CodeEditor` parses with the language the host brings. A fence with no
 *  language, or one this file does not know, stays plain: that is usually log
 *  output, where a guess would colour the wrong things. */

export type CodeTokenKind =
  | "comment"
  | "string"
  | "keyword"
  | "definition"
  | "punctuation"
  | "added"
  | "removed"
  | "meta";

export interface CodeToken {
  text: string;
  /** Absent for plain text. */
  kind?: CodeTokenKind;
}

interface Profile {
  /** Line comment markers. `#` counts only at the start of a word. */
  line: string[];
  /** Block comments as [open, close]. */
  block: [string, string][];
  /** Quote marks; a three-character mark is a multi-line string. */
  quotes: string[];
  /** Quote marks whose strings may span lines. */
  multiline?: string[];
  keywords: ReadonlySet<string>;
  /** Keywords match whatever their case (SQL). */
  anyCase?: boolean;
  /** A capitalised name is a type, shown as a definition. */
  types?: boolean;
  /** Built-in type names, shown as definitions. */
  builtinTypes?: ReadonlySet<string>;
  /** `$name` and `${…}` are variables, shown as definitions (shell). */
  dollarVars?: boolean;
  /** `name:` at the start of a line is a key, shown as a definition (YAML). */
  keys?: boolean;
}

const words = (list: string) => new Set(list.split(/\s+/).filter(Boolean));

/** Keywords per language family: one list for all of them would colour a
 *  name of one language as a keyword of another (`fn` in JavaScript). */
const JS = words(`
  abstract as async await break case catch class const continue debugger declare default
  delete do else enum export extends false finally for from function get if implements
  import in instanceof interface keyof let new null of override private protected public
  readonly return satisfies set static super switch this throw true try type typeof
  undefined var void while with yield
`);

const RUST = words(`
  as async await break const continue crate dyn else enum extern false fn for if impl in let
  loop match mod move mut pub ref return self Self static struct super trait true type
  unsafe use where while
`);

const GO = words(`
  break case chan const continue default defer else fallthrough false for func go goto if
  import interface map nil package range return select struct switch true type var
`);

const C_FAMILY = words(`
  abstract auto break case catch class const continue default delete do else enum extends
  extern false final finally for fun goto if implements import interface internal is let
  namespace new null nullptr object open operator override package private protected
  public return sealed signed sizeof static struct super switch this throw throws true try
  typedef typename union unsigned using val var virtual void volatile when while
`);

/** Built-in type names of the C family, shown as names (bold), as the editor
 *  shows a type. */
const C_TYPES = words(`
  string number boolean bigint symbol object any unknown never int uint float double char
  bool long short byte i8 i16 i32 i64 u8 u16 u32 u64 f32 f64 usize isize str
`);

const PYTHON = words(`
  and as assert async await break case class continue def del elif else except False finally
  for from global if import in is lambda match None nonlocal not or pass raise return self
  True try while with yield
`);

const RUBY = words(`
  alias and begin break case class def defined? do else elsif end ensure false for if in
  module next nil not or redo require rescue retry return self super then true undef unless
  until when while yield
`);

const SHELL = words(`
  if then else elif fi for while until do done case esac in function return local export
  readonly declare source select time
`);

const SQL = words(`
  select from where and or not in is null join left right inner outer full cross on as group
  by order having limit offset insert into values update set delete create table view index
  drop alter add column primary key foreign references distinct union all case when then
  else end with asc desc between like ilike exists true false returning default unique check
  constraint if replace temporary over partition window
`);

const JSON_WORDS = words("true false null");
const YAML_WORDS = words("true false null yes no on off ~");

/** The C family's comments and quotes, with a family's keywords. */
const cLike = (keywords: ReadonlySet<string>): Profile => ({
  line: ["//"],
  block: [["/*", "*/"]],
  quotes: ['"', "'", "`"],
  multiline: ["`"],
  keywords,
  types: true,
  builtinTypes: C_TYPES,
});

const PROFILES: Record<string, Profile> = {
  js: cLike(JS),
  rust: cLike(RUST),
  go: cLike(GO),
  c: cLike(C_FAMILY),
  python: {
    line: ["#"],
    block: [],
    quotes: ['"""', "'''", '"', "'"],
    multiline: ['"""', "'''"],
    keywords: PYTHON,
    types: true,
  },
  ruby: { line: ["#"], block: [], quotes: ['"', "'"], keywords: RUBY, types: true },
  shell: {
    line: ["#"],
    block: [],
    quotes: ['"', "'"],
    multiline: ['"', "'"],
    keywords: SHELL,
    dollarVars: true,
  },
  sql: {
    line: ["--"],
    block: [["/*", "*/"]],
    quotes: ["'", '"'],
    keywords: SQL,
    anyCase: true,
  },
  json: { line: [], block: [], quotes: ['"'], keywords: JSON_WORDS },
  yaml: { line: ["#"], block: [], quotes: ['"', "'"], keywords: YAML_WORDS, keys: true },
  css: { line: [], block: [["/*", "*/"]], quotes: ['"', "'"], keywords: words("") },
};

/** Fence names, as models write them, to a profile. */
const ALIASES: Record<string, string> = {
  js: "js",
  javascript: "js",
  jsx: "js",
  mjs: "js",
  cjs: "js",
  ts: "js",
  typescript: "js",
  tsx: "js",
  java: "c",
  kotlin: "c",
  kt: "c",
  scala: "c",
  c: "c",
  h: "c",
  cpp: "c",
  "c++": "c",
  cc: "c",
  hpp: "c",
  cs: "c",
  csharp: "c",
  go: "go",
  golang: "go",
  rust: "rust",
  rs: "rust",
  swift: "c",
  dart: "c",
  php: "c",
  zig: "c",
  py: "python",
  python: "python",
  python3: "python",
  rb: "ruby",
  ruby: "ruby",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  shell: "shell",
  fish: "shell",
  dockerfile: "shell",
  makefile: "shell",
  sql: "sql",
  psql: "sql",
  postgres: "sql",
  postgresql: "sql",
  sqlite: "sql",
  mysql: "sql",
  duckdb: "sql",
  json: "json",
  jsonc: "js",
  json5: "js",
  yaml: "yaml",
  yml: "yaml",
  toml: "yaml",
  css: "css",
  scss: "css",
  less: "css",
};

const IDENT = /[A-Za-z_][\w]*[?!]?/y;
const NUMBER = /(?:0[xX][0-9a-fA-F_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)/y;
const PUNCT = /[{}()[\];,.:<>=+\-*/%!&|^~?@]+/y;
const SPACE_THEN_PAREN = /\s*\(/y;

/** Whether a fence name is one this file highlights. */
export function knowsLanguage(lang: string): boolean {
  const name = lang.toLowerCase();
  return name === "diff" || name === "patch" || ALIASES[name] != null;
}

/** Split `code` into tokens for `lang` (a fence name: `ts`, `python`,
 *  `sql`, `diff`). An unknown language comes back as one plain token. */
export function highlightCode(code: string, lang: string): CodeToken[] {
  const name = lang.toLowerCase();
  if (name === "diff" || name === "patch") return diffTokens(code);
  const key = ALIASES[name];
  const profile = key ? PROFILES[key] : undefined;
  if (!profile) return code ? [{ text: code }] : [];
  return scan(code, profile);
}

function diffTokens(code: string): CodeToken[] {
  const out: CodeToken[] = [];
  const lines = code.split("\n");
  lines.forEach((line, i) => {
    const text = i < lines.length - 1 ? `${line}\n` : line;
    if (text === "") return;
    let kind: CodeTokenKind | undefined;
    if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@")) kind = "meta";
    else if (line.startsWith("+")) kind = "added";
    else if (line.startsWith("-")) kind = "removed";
    push(out, text, kind);
  });
  return out;
}

/** Append a token, joining it to the last one when they are the same kind. */
function push(out: CodeToken[], text: string, kind?: CodeTokenKind) {
  if (!text) return;
  const last = out[out.length - 1];
  if (last && last.kind === kind) last.text += text;
  else out.push(kind ? { text, kind } : { text });
}

function scan(code: string, p: Profile): CodeToken[] {
  const out: CodeToken[] = [];
  const n = code.length;
  let i = 0;
  const at = (s: string) => code.startsWith(s, i);
  const prevIsWordStart = () => i === 0 || /\s/.test(code[i - 1] as string);
  /** Only blanks (or a YAML list dash) before `from` on its line. */
  const firstOnLine = (from: number) =>
    /^\s*(?:-\s+)?$/.test(code.slice(code.lastIndexOf("\n", from - 1) + 1, from));
  const sticky = (re: RegExp) => {
    re.lastIndex = i;
    const m = re.exec(code);
    return m ? m[0] : null;
  };

  outer: while (i < n) {
    // Block comments.
    for (const [open, close] of p.block) {
      if (at(open)) {
        const end = code.indexOf(close, i + open.length);
        const stop = end < 0 ? n : end + close.length;
        push(out, code.slice(i, stop), "comment");
        i = stop;
        continue outer;
      }
    }
    // Line comments; `#` only where a word starts.
    for (const marker of p.line) {
      if (at(marker) && (marker !== "#" || prevIsWordStart())) {
        const end = code.indexOf("\n", i);
        const stop = end < 0 ? n : end;
        push(out, code.slice(i, stop), "comment");
        i = stop;
        continue outer;
      }
    }
    // Strings; the longest quote mark first, so `"""` wins over `"`.
    for (const q of p.quotes) {
      if (!at(q)) continue;
      const multi = p.multiline?.includes(q) ?? false;
      let j = i + q.length;
      while (j < n) {
        const ch = code[j] as string;
        if (ch === "\\" && q.length === 1) {
          j += 2;
          continue;
        }
        if (code.startsWith(q, j)) {
          j += q.length;
          break;
        }
        if (ch === "\n" && !multi) break;
        j++;
      }
      push(out, code.slice(i, Math.min(j, n)), "string");
      i = Math.min(j, n);
      continue outer;
    }
    const ch = code[i] as string;
    // Shell variables.
    if (p.dollarVars && ch === "$") {
      const braced = code[i + 1] === "{" ? code.indexOf("}", i) : -1;
      const m =
        braced > 0
          ? code.slice(i, braced + 1)
          : /^\$(?:[A-Za-z_]\w*|[0-9#?@*$!-])/.exec(code.slice(i))?.[0];
      if (m) {
        push(out, m, "definition");
        i += m.length;
        continue;
      }
    }
    // Names: a keyword, a call, a type, a YAML key, or plain.
    if (/[A-Za-z_]/.test(ch) && (i === 0 || !/[\w$]/.test(code[i - 1] as string))) {
      const word = sticky(IDENT) ?? ch;
      const start = i;
      i += word.length;
      const isKeyword = p.keywords.has(p.anyCase ? word.toLowerCase() : word);
      if (isKeyword) {
        push(out, word, "keyword");
        continue;
      }
      if (p.keys && code[i] === ":" && firstOnLine(start)) {
        push(out, word, "definition");
        continue;
      }
      if (sticky(SPACE_THEN_PAREN) != null && !p.keys) {
        push(out, word, "definition");
        continue;
      }
      if ((p.types && /^[A-Z][a-z0-9]/.test(word)) || p.builtinTypes?.has(word)) {
        push(out, word, "definition");
        continue;
      }
      push(out, word);
      continue;
    }
    // Numbers are left plain, as in the editor's themes; they are scanned so a
    // digit inside one is not read as the start of a name.
    if (/\d/.test(ch) && (i === 0 || !/[\w$]/.test(code[i - 1] as string))) {
      const num = sticky(NUMBER) ?? ch;
      push(out, num);
      i += num.length;
      continue;
    }
    const punct = sticky(PUNCT);
    if (punct) {
      // A comment marker inside a run of punctuation ends the run.
      let len = punct.length;
      for (const marker of [...p.line, ...p.block.map(([open]) => open)]) {
        const k = punct.indexOf(marker);
        if (k > 0 && k < len && marker !== "#") len = k;
      }
      push(out, code.slice(i, i + len), "punctuation");
      i += len;
      continue;
    }
    push(out, ch);
    i++;
  }
  return out;
}
