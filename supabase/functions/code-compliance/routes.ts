// Analisi fra file degli endpoint HTTP e dei controlli di autorizzazione.
//
// Una credenziale nel codice si trova con un'espressione; sapere se tutte le API verificano i
// permessi richiede seguire rotte, middleware e configurazioni in più file. Questo modulo
// censisce le rotte dei framework più comuni, cerca per ciascuna una prova di controllo
// (middleware sulla rotta, decoratore, controllo nel corpo della funzione) e riconosce i
// controlli globali (app.use(auth) prima delle rotte, guard applicativo, permessi di default).
// L'esito è un elenco: rotte censite, protette, pubbliche per natura, senza controllo
// riconoscibile. È un'analisi euristica: quello che non riconosce finisce fra i "da verificare",
// mai fra i "verificati".

import { isCommentLine, TEST_FILE, TEXT_FILE } from "./rules.ts";

export interface Route {
  file: string; line: number; method: string; path: string; framework: string;
  /** Prova del controllo di autorizzazione, con file e riga, oppure null. */
  auth: string | null;
  /** Pubblica per natura (login, salute, risorse statiche...). */
  publicByNature: boolean;
  /** Scrive o modifica dati: senza controllo pesa di più. */
  mutating: boolean;
}
export interface RouteAnalysis {
  routes: Route[];
  globalGuards: Array<{ file: string; line: number; snippet: string; scope: string }>;
  frameworks: string[];
}

const METHODS = "get|post|put|patch|delete|del|all|options|head";

/** Rotte per riga, con il nome del framework. */
const ROUTE_PATTERNS: Array<{ re: RegExp; framework: string; method: (m: RegExpExecArray) => string; path: (m: RegExpExecArray) => string; handler?: (m: RegExpExecArray) => string }> = [
  // Express, Koa router, Fastify, Hapi-like: app.get('/x', mw, handler)
  { re: new RegExp(String.raw`\b(?:app|router|server|fastify|routes?)\.(${METHODS})\s*\(\s*(['"\`])([^'"\`]+)\2`, "i"), framework: "express", method: (m) => m[1].toUpperCase(), path: (m) => m[3] },
  // Express router.route('/x').post(...)
  { re: /\.route\s*\(\s*(['"`])([^'"`]+)\1\s*\)\s*\.(get|post|put|patch|delete|all)\s*\(/i, framework: "express", method: (m) => m[3].toUpperCase(), path: (m) => m[2] },
  // NestJS: @Get('x') @Post()
  { re: /^\s*@(Get|Post|Put|Patch|Delete|All|Head|Options)\s*\(\s*(?:(['"`])([^'"`]*)\2)?\s*\)/, framework: "nestjs", method: (m) => m[1].toUpperCase(), path: (m) => m[3] || "/" },
  // Flask: @app.route('/x', methods=['POST']) / @bp.route
  { re: /^\s*@\w+\.route\s*\(\s*(['"])([^'"]+)\1(?:[^)]*methods\s*=\s*\[([^\]]*)\])?/, framework: "flask", method: (m) => (m[3] ? m[3].replace(/['"\s]/g, "").toUpperCase() : "GET"), path: (m) => m[2] },
  // FastAPI / Flask method shortcuts: @app.get('/x') @router.post('/x')
  { re: new RegExp(String.raw`^\s*@\w+\.(${METHODS})\s*\(\s*(['"])([^'"]+)\2`, "i"), framework: "fastapi", method: (m) => m[1].toUpperCase(), path: (m) => m[3] },
  // Django urls: path('x/', view) / re_path
  { re: /\b(?:re_)?path\s*\(\s*(['"])([^'"]*)\1\s*,\s*([\w.]+)/, framework: "django", method: () => "ANY", path: (m) => "/" + m[2], handler: (m) => m[3] },
  // Spring: @GetMapping("/x") @RequestMapping(value="/x", method=...)
  { re: /^\s*@(Get|Post|Put|Patch|Delete|Request)Mapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?(?:\{\s*)?(['"])([^'"]*)\2/, framework: "spring", method: (m) => (m[1] === "Request" ? "ANY" : m[1].toUpperCase()), path: (m) => m[3] },
  // ASP.NET: [HttpGet("x")] [HttpPost]
  { re: /^\s*\[Http(Get|Post|Put|Patch|Delete)\s*(?:\(\s*"([^"]*)"\s*\))?\]/, framework: "aspnet", method: (m) => m[1].toUpperCase(), path: (m) => m[2] || "/" },
  // Go: r.GET("/x", h) (gin, echo), http.HandleFunc("/x", h), mux.Handle
  { re: /\b\w+\.(GET|POST|PUT|PATCH|DELETE|Get|Post|Put|Patch|Delete|HandleFunc|Handle)\s*\(\s*"([^"]+)"/, framework: "go", method: (m) => (/^Handle/.test(m[1]) ? "ANY" : m[1].toUpperCase()), path: (m) => m[2] },
  // Laravel: Route::post('/x', ...)
  { re: new RegExp(String.raw`\bRoute::(${METHODS}|any|match)\s*\(\s*(['"])([^'"]+)\2`, "i"), framework: "laravel", method: (m) => m[1].toUpperCase(), path: (m) => m[3] },
];

/** Controlli di autorizzazione riconoscibili sulla rotta, nei decoratori o nel corpo. */
const AUTH_ON_ROUTE = /\b(denyAll|deny\s*\(|forbid|auth|authenticate[d]?|authenticated|requireAuth|requireLogin|requireUser|requireRole|requireAdmin|requiresAuth|isAuthenticated|isAuthorized|isAdmin|isLoggedIn|ensureAuth|ensureLoggedIn|ensureAuthenticated|protect|protected|guard|authGuard|jwtAuth|jwtCheck|checkJwt|checkAuth|checkToken|verifyToken|verifyJwt|validateToken|authorize[d]?|authorization|permission[s]?|hasRole|hasPermission|allowRoles|roles\s*\(|withAuth|secured?|passport\.authenticate|expressjwt|jwt\s*\(\s*\{|bearerAuth|basicAuth|apiKeyAuth|session[Aa]uth|loginRequired|login_required|jwt_required|permission_required|permission_classes|IsAuthenticated|IsAdminUser|DjangoModelPermissions|Depends\s*\(\s*(get_current|current_user|verify|auth|require|oauth2|security|has_)|HTTPBearer|HTTPBasic|OAuth2PasswordBearer|@PreAuthorize|@Secured|@RolesAllowed|@UseGuards|@Auth\b|\[Authorize|AuthMiddleware|authMiddleware|AuthRequired|middleware\s*\(\s*\[?\s*['"]auth|->middleware\s*\(\s*['"](auth|can:|role:|permission:)|auth\.required|ensure_logged_in|before_action\s*:authenticate|authenticate_user!|current_user)\b/i;
const AUTH_IN_BODY = /\b(req\.(user|auth|session\.user|isAuthenticated\(\))|request\.user\b|request\.user\.is_authenticated|current_user|currentUser|get_current_user|getCurrentUser|getSession\s*\(|auth\.getUser\s*\(|getServerSession|getUser\s*\(|session\.get\s*\(\s*['"]user|session\[['"]user|ctx\.state\.user|c\.get\s*\(\s*['"]user|jwt\.verify\s*\(|verify_jwt|decode_token|requireUser|requireAuth|Unauthorized|UNAUTHORIZED|401|403|Forbidden|res\.sendStatus\s*\(\s*40[13]|status\s*\(\s*40[13]\s*\)|abort\s*\(\s*40[13]|HTTPException\s*\(\s*status_code\s*=\s*40[13]|PermissionDenied|raise_for_status|checkPermission|hasPermission|can\s*\(\s*['"]|authorize\s*\()\b/i;
/** Controlli globali: valgono per tutte le rotte che seguono (o per il prefisso indicato). */
const GLOBAL_GUARD = /\b(app|router|server|api)\.use\s*\((?:\s*(['"`])([^'"`]*)\2\s*,)?\s*[^)]*\b(auth|authenticate|requireAuth|protect|jwt|expressjwt|passport\.(authenticate|session)|verifyToken|checkJwt|authMiddleware|AuthMiddleware|ensureAuth|isAuthenticated|isAuthorized|authorize|denyAll|requireRole|hasRole|permission\w*|session\s*\()\b|addHook\s*\(\s*['"](onRequest|preHandler|preValidation)['"]\s*,\s*[^)]*\b(auth|verify|jwt)\b|APP_GUARD|DEFAULT_PERMISSION_CLASSES[\s\S]{0,120}?IsAuthenticated|anyRequest\s*\(\s*\)\s*\.authenticated\s*\(|\.authorizeHttpRequests|RequireAuthorization\s*\(\)|FallbackPolicy|before_action\s+:authenticate|Depends\s*\(\s*(get_current_user|verify_token|auth)[^)]*\)\s*\]|dependencies\s*=\s*\[\s*Depends|router\s*=\s*APIRouter\s*\([^)]*dependencies|Route::middleware\s*\(\s*\[?\s*['"]auth/i;
/** Rotte pubbliche per natura: non hanno bisogno di autenticazione. */
const PUBLIC_PATH = /(^|\/)(login|logout|signin|sign-in|signup|sign-up|register|registration|auth|oauth|callback|sso|token|refresh|forgot|reset|verify|confirm|activate|health|healthz|healthcheck|ready|readiness|liveness|alive|ping|status|metrics|version|public|static|assets|favicon|robots\.txt|sitemap|docs|swagger|openapi|redoc|graphql|webhooks?|stripe|paypal|contact|newsletter|subscribe|captcha|\.well-known|manifest\.json|service-worker|sw\.js)(\/|$|\.)/i;
/** Un decoratore o attributo il cui nome parla di autenticazione, permessi o ruoli. */
const DECORATOR_AUTH = /^\s*[@[]\w*[.:]?\w*(auth|login|permission|perms?\b|role|jwt|secured|protect|guard|token_required|authorize|allow_?(roles|users))\w*/i;
const HANDLER_LOOKAHEAD = 25;
const DECORATOR_LOOKBACK = 6;

const CODE_FILE = /\.(js|mjs|cjs|ts|mts|py|java|kt|go|php|cs|rb)$/i;
/** Cartelle di frammenti, esempi e dati: contengono codice che non gira. */
const NOT_RUNTIME = /(^|\/)(migrations?|seeds?|fixtures?|docs?|examples?|samples?|snippets?|codefixes|static\/[^/]*\/?codefixes|data\/static|storybook|stories|mocks?|__mocks__)\//i;
/** File che per nome contengono i flussi di accesso: le loro rotte sono pubbliche per natura. */
const AUTH_FILE = /(^|\/)(auth|login|signup|register|session|oauth|sso)[\w.-]*\.(js|mjs|cjs|ts|mts|py|java|kt|go|php|cs|rb)$/i;

/**
 * Il gestore di una rotta può stare in un altro file (controller, views.py): si cerca la sua
 * definizione per nome e si guarda se, nei decoratori o nelle prime righe, controlla l'utente.
 */
function handlerAuth(files: Array<{ name: string; content: string }>, handler: string, fromFile: string): string | null {
  const name = handler.replace(/\.as_view\(\)$/, "").split(".").pop() || "";
  if (!/^[A-Za-z_]\w{2,}$/.test(name) || /^(function|async|req|res|next|lambda|self)$/.test(name)) return null;
  const def = new RegExp(String.raw`^\s*(?:export\s+)?(?:async\s+)?(?:def|function|class)\s+${name}\b|^\s*(?:export\s+)?(?:const|let|var)\s+${name}\s*=|^\s*(?:async\s+)?${name}\s*\([^)]*\)\s*\{|^\s*${name}\s*:\s*(?:async\s*)?(?:\(|function)`);
  const dir = fromFile.includes("/") ? fromFile.slice(0, fromFile.lastIndexOf("/")) : "";
  // Prima i file della stessa cartella (views.py accanto a urls.py), poi gli altri.
  const ordered = [...files].sort((a, b) => Number(!a.name.startsWith(dir)) - Number(!b.name.startsWith(dir)));
  for (const f of ordered) {
    if (!CODE_FILE.test(f.name) || TEST_FILE.test(f.name) || f.content.length > 400_000 || !f.content.includes(name)) continue;
    const lines = f.content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (!def.test(lines[i])) continue;
      for (let k = i - 1; k >= Math.max(0, i - DECORATOR_LOOKBACK); k--) {
        const l = lines[k];
        if (!/^\s*[@[]/.test(l)) { if (l.trim() && !isCommentLine(l)) break; else continue; }
        if (AUTH_ON_ROUTE.test(l) || DECORATOR_AUTH.test(l)) return `decoratore sul gestore ${name} (${f.name}:${k + 1})`;
      }
      if (/class\s+\w+\s*\([^)]*(LoginRequiredMixin|PermissionRequiredMixin|UserPassesTestMixin|APIView)/.test(lines[i]) && /LoginRequiredMixin|PermissionRequiredMixin|UserPassesTestMixin/.test(lines[i])) return `mixin di autenticazione sulla classe ${name} (${f.name}:${i + 1})`;
      for (let k = i + 1; k <= Math.min(lines.length - 1, i + HANDLER_LOOKAHEAD); k++) {
        const l = lines[k];
        if (/^\s*(def|function|class)\s+\w+|^\s*(export\s+)?(const|let|var)\s+\w+\s*=/.test(l) && k > i + 1) break;
        if (!isCommentLine(l) && (AUTH_IN_BODY.test(l) || /permission_classes|login_required|method_decorator\s*\(\s*login_required/.test(l))) return `controllo nel gestore ${name} (${f.name}:${k + 1})`;
      }
      return null;
    }
  }
  return null;
}

export function analyzeRoutes(files: Array<{ name: string; content: string }>): RouteAnalysis {
  const routes: Route[] = [];
  const globalGuards: RouteAnalysis["globalGuards"] = [];
  const frameworks = new Set<string>();

  for (const f of files) {
    if (!CODE_FILE.test(f.name) || TEXT_FILE.test(f.name) || TEST_FILE.test(f.name) || f.content.length > 400_000) continue;
    if (NOT_RUNTIME.test(f.name)) continue;
    const lines = f.content.split(/\r?\n/);
    const fileGuards: Array<{ line: number; prefix: string }> = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim() || isCommentLine(line)) continue;
      const g = GLOBAL_GUARD.exec(line);
      if (g) {
        const prefix = g[3] || "";
        fileGuards.push({ line: i, prefix });
        globalGuards.push({ file: f.name, line: i + 1, snippet: line.trim().slice(0, 160), scope: prefix || "tutte le rotte del file che seguono" });
        continue;
      }
      // Catena su più righe: app.route('/x')\n  .get(...)\n  .put(...)
      let chained: RegExpExecArray | null = null;
      let chainedPath = "";
      if (/^\s*\.(get|post|put|patch|delete|all)\s*\(/i.test(line)) {
        for (let k = i - 1; k >= Math.max(0, i - 6); k--) {
          const rm = /\.route\s*\(\s*(['"`])([^'"`]+)\1\s*\)/.exec(lines[k] || "");
          if (rm) { chainedPath = rm[2]; break; }
          if (!/^\s*\./.test(lines[k] || "")) break;
        }
        if (chainedPath) chained = /^\s*\.(get|post|put|patch|delete|all)\s*\(/i.exec(line);
      }
      const patterns = chained
        ? [{ re: /^\s*\.(get|post|put|patch|delete|all)\s*\(/i, framework: "express", method: (m: RegExpExecArray) => m[1].toUpperCase(), path: () => chainedPath }]
        : ROUTE_PATTERNS;
      for (const p of patterns) {
        const m = p.re.exec(line);
        if (!m) continue;
        const path = p.path(m) || "/";
        const method = p.method(m);
        // app.get('view engine') è un'impostazione, non una rotta; path() di Django vive in urls.py.
        if (p.framework === "express" && !/^[/*]/.test(path)) continue;
        if (p.framework === "django" && !/urls\.py$/.test(f.name)) continue;
        frameworks.add(p.framework);
        let auth: string | null = null;
        // 1. Sulla stessa riga: middleware o decoratore inline.
        const rest = line.replace(m[0], "");
        if (AUTH_ON_ROUTE.test(rest)) auth = `controllo sulla rotta (${f.name}:${i + 1})`;
        else if (AUTH_IN_BODY.test(rest)) auth = `controllo nel corpo della funzione (${f.name}:${i + 1})`;
        // 2. Nei decoratori o attributi appena sopra (Python, Java, NestJS, C#).
        if (!auth) {
          for (let k = i - 1; k >= Math.max(0, i - DECORATOR_LOOKBACK); k--) {
            const l = lines[k];
            if (!/^\s*[@[]/.test(l)) { if (l.trim() && !isCommentLine(l)) break; else continue; }
            if (AUTH_ON_ROUTE.test(l) || DECORATOR_AUTH.test(l)) { auth = `decoratore di autorizzazione (${f.name}:${k + 1})`; break; }
          }
        }
        // 3. Nelle righe seguenti, finché dura il gestore: un controllo esplicito dell'utente.
        if (!auth) {
          for (let k = i + 1; k <= Math.min(lines.length - 1, i + HANDLER_LOOKAHEAD); k++) {
            const l = lines[k];
            if (ROUTE_PATTERNS.some((q) => q.re.test(l))) break;
            if (!isCommentLine(l) && AUTH_IN_BODY.test(l)) { auth = `controllo nel corpo della funzione (${f.name}:${k + 1})`; break; }
          }
        }
        // 4. Un controllo globale dichiarato prima nello stesso file, con prefisso compatibile.
        if (!auth) {
          const g = fileGuards.find((x) => x.line < i && (!x.prefix || path.startsWith(x.prefix)));
          if (g) auth = `controllo globale (${f.name}:${g.line + 1})`;
        }
        // 5. Il gestore è definito altrove (controller, views.py): si segue il nome fra i file.
        if (!auth) {
          const handler = p.handler ? p.handler(m) : (/,\s*([A-Za-z_][\w.]*)\s*\)\s*;?\s*$/.exec(line)?.[1] ?? "");
          if (handler) auth = handlerAuth(files, handler, f.name);
        }
        // 6. Per i decoratori di classe (NestJS, Spring, ASP.NET) il guard sta sopra la classe.
        if (!auth && (p.framework === "nestjs" || p.framework === "spring" || p.framework === "aspnet")) {
          const head = lines.slice(0, i).join("\n");
          const cls = /@UseGuards|@PreAuthorize|@Secured|@RolesAllowed|\[Authorize/.exec(head);
          if (cls) auth = `controllo sulla classe (${f.name})`;
        }
        routes.push({
          file: f.name, line: i + 1, method, path, framework: p.framework, auth,
          publicByNature: PUBLIC_PATH.test(path) || path === "/" || path === "*" || /^(OPTIONS|HEAD)$/.test(method) || AUTH_FILE.test(f.name),
          mutating: /^(POST|PUT|PATCH|DELETE|DEL)$/.test(method),
        });
        break;
      }
    }
  }

  // Un controllo globale di applicazione (guard NestJS, permessi di default DRF, catena Spring,
  // RequireAuthorization ASP.NET) copre tutte le rotte dei file che non ne hanno uno proprio.
  const appWide = globalGuards.filter((g) => /APP_GUARD|DEFAULT_PERMISSION_CLASSES|anyRequest|RequireAuthorization|FallbackPolicy|authorizeHttpRequests/.test(g.snippet));
  if (appWide.length) {
    for (const r of routes) if (!r.auth) r.auth = `controllo globale dell'applicazione (${appWide[0].file}:${appWide[0].line})`;
  }
  // La stessa rotta dichiarata più volte (catene di middleware in Express) è una rotta sola:
  // se una delle dichiarazioni ha il controllo, lo hanno tutte quelle che seguono.
  const byKey = new Map<string, Route>();
  for (const r of routes) {
    const key = `${r.method} ${r.path}`;
    const seen = byKey.get(key);
    if (!seen) { byKey.set(key, { ...r }); continue; }
    if (!seen.auth && r.auth) seen.auth = r.auth;
    seen.publicByNature = seen.publicByNature || r.publicByNature;
  }
  return { routes: [...byKey.values()], globalGuards, frameworks: [...frameworks] };
}

/** Rotte senza controllo riconoscibile, le più gravi prima. */
export function unprotectedRoutes(a: RouteAnalysis): Route[] {
  return a.routes
    .filter((r) => !r.auth && !r.publicByNature)
    .sort((x, y) => Number(y.mutating) - Number(x.mutating) || x.file.localeCompare(y.file) || x.line - y.line);
}
