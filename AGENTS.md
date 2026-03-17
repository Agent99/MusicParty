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

2. **Backend cannot start without at least one music API enabled.** Configuration uses `__` separator for env vars, e.g. `MusicApi__Bilibili__Enabled=true`. The recommended way to start the backend for development is:
   - Start the Netease Cloud Music API server: `PORT=3001 npx NeteaseCloudMusicApi@latest`
   - Start the backend with Netease QR login (no credentials needed upfront):
     ```
     MusicApi__NeteaseCloudMusic__Enabled=true \
     MusicApi__NeteaseCloudMusic__ApiServerUrl=http://localhost:3001 \
     MusicApi__NeteaseCloudMusic__PhoneNo=placeholder \
     MusicApi__NeteaseCloudMusic__Cookie= \
     MusicApi__QQMusic__Enabled=false \
     MusicApi__Bilibili__Enabled=false \
     FrontEndUrl=http://localhost:3000 \
     dotnet run
     ```
   - The backend will print a QR code to the terminal. Scan it with the Netease Cloud Music mobile app to complete login.
   - After successful login, a `cookie.txt` file is saved in `MusicParty/` and reused on subsequent runs.

3. **No automated tests exist** in this repository. Testing is limited to lint (`pnpm lint`) and build verification (`dotnet build`, `pnpm build`).

4. **Frontend ESLint** requires `eslint` and `eslint-config-next` as devDependencies (added to `package.json`). Config is in `music-party/.eslintrc.json`.

5. **Frontend uses pnpm** (lockfile: `pnpm-lock.yaml`). Do not use npm or yarn.

6. **Backend proxies frontend** in production mode via `FrontEndUrl` config (defaults to `http://localhost:3000`). In development, run frontend and backend separately.
