# AGENTS.md

## Cursor Cloud specific instructions

### Project Overview

Music Party is a collaborative music listening web app with a **Next.js 13 frontend** (`music-party/`) and a **.NET 6.0 ASP.NET Core backend** (`MusicParty/`). The backend integrates with Chinese music platforms (Netease Cloud Music, QQ Music, Bilibili) via adapter pattern.

### Services

| Service | Directory | Dev Command | Port |
|---|---|---|---|
| Frontend | `music-party/` | `pnpm dev` | 3000 |
| Backend | `MusicParty/` | `dotnet run` | 5000 |

### Key Development Commands

- **Frontend install**: `cd music-party && pnpm install`
- **Frontend dev**: `cd music-party && pnpm dev`
- **Frontend lint**: `cd music-party && pnpm lint`
- **Frontend build**: `cd music-party && pnpm build`
- **Backend restore**: `dotnet restore` (from repo root)
- **Backend build**: `dotnet build` (from repo root)
- **Backend run**: `cd MusicParty && dotnet run`

### Important Caveats

1. **.NET SDK 6.0 is required.** It is installed at `$HOME/.dotnet`. Ensure `PATH` includes `$HOME/.dotnet` and `DOTNET_ROOT` is set (already configured in `~/.bashrc`).

2. **Backend cannot start without valid music API credentials.** At least one music API (Netease/QQ/Bilibili) must be enabled with valid credentials in `MusicParty/appsettings.json` or via environment variables. Without credentials, the backend throws `"Cannot start without any music api service."` Configuration uses `__` separator for env vars, e.g. `MusicApi__Bilibili__Enabled=true`.

3. **No automated tests exist** in this repository. Testing is limited to lint (`pnpm lint`) and build verification (`dotnet build`, `pnpm build`).

4. **Frontend ESLint** requires `eslint` and `eslint-config-next` as devDependencies (added to `package.json`). Config is in `music-party/.eslintrc.json`.

5. **Frontend uses pnpm** (lockfile: `pnpm-lock.yaml`). Do not use npm or yarn.

6. **Backend proxies frontend** in production mode via `FrontEndUrl` config (defaults to `http://localhost:3000`). In development, run frontend and backend separately.
