# team-front-skill

🇬🇧 [Read in English](README.md)

Next.js və React üçün komandanın frontend standartlarını saxlayan Claude Code paketi.
Cari versiya: `VERSION` faylına bax (dəyişikliklər `CHANGELOG.md`-dədir).

| Yol | Nədir |
| --- | --- |
| `skills/team-frontend/STANDARDS.md` | **Standartın özü** (Confluence-ə yapışdırmaq üçün). Yeganə həqiqət mənbəyi. |
| `skills/team-frontend/SKILL.md` | Skill: frontend kodu yazanda/review edəndə avtomatik tətbiq olunur |
| `skills/team-frontend/references/` | Ətraflı qaydalar + kod şablonları (offline, xarici URL yoxdur) |
| `skills/front-template/` | Skill: `/front-template` komanda formatında layihə, FSD slice və komponent yaradır |
| `agents/front-reviewer.md` | Subagent: standarta görə yalnız oxuyan review |
| `agents/front-refactorer.md` | Subagent: kodu standarta uyğun bölür/refactor edir, testləri yaşıl saxlayır |
| `commands/front-setup.md` | `/front-setup [audit-only]`: audit + tooling, testlər, CI, http, təhlükəsizlik, monitorinq, FSD qurulması |
| `.claude-plugin/` | Plugin manifesti (`plugin.json`) və marketplace (`marketplace.json`) |
| `install.*` / `uninstall.*` | `.claude/` qovluğuna kopyalama ilə quraşdırma və silmə |
| `scripts/validate.mjs` | Paketin yoxlanması (lokalda və GitHub Actions-da işləyir) |

### References

| Fayl | Mövzu |
| --- | --- |
| `fsd.md` | Feature-Sliced Design: layer-lər, slice-lar, public API |
| `components.md` | 150 sətir limiti, bölmə, props |
| `use-effect.md` | `useEffect` əvəzləri |
| `react-patterns.md` | composition, data-fetching, performance pattern-ləri |
| `nextjs.md` | App Router, RSC, caching, Server Actions, `proxy.ts` |
| `react-tanstack-router.md` | TanStack Router ilə React (Vite) routing |
| `http-axios.md` | axios client + refresh interceptor, Next server üçün `serverFetch`, env, token-lər, cookie-lər |
| `security.md` | CSP, security header-lər, XSS, cookie/CSRF, Server Actions, secret-lər, audit |
| `state-data.md` | TanStack Query, Zustand |
| `ui-tailwind-shadcn.md` | Tailwind v4, shadcn/ui, əlçatanlıq (a11y) |
| `testing-vitest.md` | Vitest + Testing Library + MSW |
| `e2e-playwright.md` | Playwright E2E + avtomatik a11y (`@axe-core/playwright`) |
| `observability.md` | Sentry, error boundary-lər, logging, Web Vitals, performance büdcələri |
| `i18n.md` | next-intl (Next) / react-i18next (React), `Intl`, RTL |
| `tooling.md` | package manager-in təyini, ESLint, Prettier, husky, commitlint |
| `ci.md` | Hədəf layihələr üçün GitHub Actions şablonu |
| `dependency-updates.md` | versiya yoxlaması və yeniləmələr |
| `refactoring-smells.md` | code smell-lər və refactoring-lər |

## Komanda üzvləri üçün sürətli başlanğıc

**Başlamazdan əvvəl:** sənə Claude Code və GitHub-da `jszsource/team-front-skill`
repo-suna oxuma icazəsi lazımdır. Repo private-dirsə, səni əlavə etmələrini
istə, sonra git-in GitHub-a qoşula bildiyindən əmin ol (SSH açarı və ya `gh auth login`).

Bunlardan **birini** seç:

1. **Frontend repo-nda artıq plugin olan `.claude/settings.json` var
   (aşağıda Variant B).** Layihəni Claude Code-da aç və plugin-i quraşdırmaq
   təklifini qəbul et. Bu qədər.
2. **Yalnız özün üçün istəyirsən:** Variant A-dakı iki `/plugin` əmrini işə sal.
3. **İşlədiyini yoxla:** React/Next.js layihəsində Claude-dan "create a product
   list page" istə və ya `/team-front-skill:front-setup audit-only` işə sal.

Yeni versiyaya keçmək üçün: `/plugin marketplace update team-front`.

## Quraşdırma

### Variant A — Claude Code plugin (tövsiyə olunur)

```text
/plugin marketplace add jszsource/team-front-skill
/plugin install team-front-skill@team-front
```

`jszsource/team-front-skill` əvəzinə tam git URL və ya lokal yol da yaza bilərsən.

Plugin əmrləri və skill-lər namespace ilə olur, məsələn `/team-front-skill:front-setup`,
`/team-front-skill:front-template next`. Yeni versiya çıxanda marketplace-i
yenilə (`/plugin marketplace update team-front`) və plugin-i `/plugin` menyusundan update et.

### Variant B — bütün frontend repo üçün aktivləşdir (bütün komanda üçün)

Bunu **frontend layihəsinin** `.claude/settings.json` faylına commit et. Həmin
layihəni Claude Code-da açan hər kəsə plugin-i quraşdırmaq təklif olunur, heç kim
əl ilə əmr yazmır:

```json
{
  "extraKnownMarketplaces": {
    "team-front": {
      "source": { "source": "github", "repo": "jszsource/team-front-skill" }
    }
  },
  "enabledPlugins": {
    "team-front-skill@team-front": true
  }
}
```

Fayl artıq varsa, bu açarları onun içinə birləşdir.

### Variant C — installer ilə `.claude/` qovluğuna kopyala

Layihənin kök qovluğundan (`.claude/` olmalı yerdən):

```bash
# macOS / Linux / Git Bash
bash /path/to/team-front-skill/install.sh
```

```powershell
# Windows PowerShell
powershell -ExecutionPolicy Bypass -File C:\path\to\team-front-skill\install.ps1
```

Bütün layihələrin üçün quraşdırmaq istəyirsənsə, hədəfi göstər:
`install.sh ~/.claude` / `install.ps1 -Target $HOME\.claude`.

**Yeniləmə.** Installer-i yeni versiyadan yenidən işə sal. Versiyanı
`skills/<skill>/.installed-version` faylına yazır və köhnə → yeni göstərir. Quraşdırılmış
skill qovluğu yenisindən fərqlənirsə (lokal dəyişikliklər və ya köhnə versiya), əvvəlcə
`.claude/.team-front-backup/<skill>-<old-version>` qovluğuna backup olunur (belə backup
artıq varsa, sonuna timestamp əlavə olunur), sonra əvəz edilir. Agent və command-lar
üzərinə yazılır. Lokal dəyişiklikləri backup-dan əl ilə geri qaytar.

**Silmə.**

```bash
bash /path/to/team-front-skill/uninstall.sh [target-.claude-dir]
```

```powershell
powershell -ExecutionPolicy Bypass -File C:\path\to\team-front-skill\uninstall.ps1 [-Target <dir>]
```

Yalnız paketlə gələn skill, agent və command-ları silir; `.team-front-backup/`
içindəki backup-lar saxlanılır. Plugin kimi quraşdırılıbsa:
`/plugin uninstall team-front-skill@team-front`.

## İstifadə

- Sadəcə işlə: "create a product list page", "add login with refresh token" →
  skill avtomatik götürülür.
- `/front-template react` — boş qovluqda (`package.json` yoxdur): elə bu qovluqda React layihəsi (Vite + TanStack Router) qurur.
- `/front-template next` — eyni, ən son Next.js (App Router) ilə.
- `/front-template project my-app react` — yeni `my-app/` qovluğunda yeni React layihəsi (Vite + TanStack Router).
- `/front-template project my-app next` — yeni Next.js (App Router) layihəsi.
- `/front-template entity product` · `feature add-to-cart` · `widget product-list` · `view products` — testləri ilə FSD slice.
- `/front-template component widgets/header UserMenu` — komponenti düzgün qovluqda yaradır.
- `/front-setup` — layihəni audit edir və standarta gətirir (dependency versiya yoxlamasını da edir).
- `/front-setup audit-only` — yalnız hesabat.
- "use front-reviewer to review my changes"
- "use front-refactorer on src/widgets/product-list"

Plugin kimi quraşdırılıbsa, əmrlərin əvvəlinə `team-front-skill:` əlavə et.

## Paketin yoxlanması

```bash
node scripts/validate.mjs     # və ya: npm run validate   (Node 20+, dependency yoxdur)
```

Frontmatter-i, çarpaz istinadları, `SKILL.md`-dəki reference indeksini,
versiya uyğunluğunu, installer/uninstaller paritetini və qayda mətnində
xarici URL olmadığını yoxlayır. Eyni yoxlama installer smoke testləri ilə birlikdə
GitHub Actions-da işləyir (`.github/workflows/validate.yml`).

## Standartın dəyişdirilməsi

1. `STANDARDS.md`-i redaktə et (əvvəlcə Confluence-də müzakirə et).
2. `references/`-dəki uyğun fayl(lar)ı yenilə (generasiya olunan kod dəyişirsə,
   `front-template/templates/`-i də).
3. Versiyanı hər yerdə artır: `VERSION`, `.claude-plugin/plugin.json`,
   `.claude-plugin/marketplace.json`, `package.json`, `STANDARDS.md`-in status
   sətri, və `CHANGELOG.md`-ə qeyd əlavə et.
4. `node scripts/validate.mjs` işə sal və bütün problemləri düzəlt.
5. Push et; komanda üzvləri plugin-i `/plugin` menyusundan update edir və ya installer-i yenidən işə salır.
