# C# Code Review Report — MusicParty

**Date:** 2026-03-17  
**Scope:** All 18 `.cs` files across `MusicParty/`, `MusicApiContract/`, `NeteaseCloudMusicApi/`, `QQMusicApi/`, `BilibiliApi/`  
**Build status:** `dotnet build` — 0 warnings, 0 errors

---

## Critical Severity

### C1. Thread-Safety — Race conditions on all shared state in `MusicHub`

**Files:** `MusicParty/Hub/MusicHub.cs` (lines 10–13)

```csharp
private static HashSet<string> OnlineUsers { get; } = new();
private static List<string> DuplicatedConnectionIds { get; } = new();
private static Queue<(string name, string content)> Last5Chat { get; } = new();
private static string? CurrentDemonLord { get; set; } = null;
```

SignalR creates **a new Hub instance per invocation**. All four static collections are read and mutated from multiple concurrent hub calls (`OnConnectedAsync`, `OnDisconnectedAsync`, `ChatSay`, `GetOnlineUsers`) with **zero synchronization**. `HashSet<T>`, `List<T>`, and `Queue<T>` are not thread-safe.

**Impact:** Corrupted internal state, lost entries, `InvalidOperationException` during enumeration, phantom duplicates.

**Fix:** Replace with `ConcurrentDictionary`, `ConcurrentQueue`, or protect all accesses with `lock`. For `CurrentDemonLord`, use `volatile` or `Interlocked`.

---

### C2. Thread-Safety — Race conditions in `MusicBroadcaster`

**File:** `MusicParty/MusicBroadcaster.cs`

- `NowPlaying` (line 9) is read/written from the background `Loop()` task, from `NextSong()`, and from `EnqueueMusic()` concurrently with no synchronization.
- `MusicQueue` (line 10, a `ToppableQueue<T>` extending `LinkedList<T>`) is accessed from `Loop()` (line 36), `EnqueueMusic()` (line 106), `TopSong()` (line 128), `DelSong()` (line 133), and `DeleteSong()` (line 228) concurrently. Only `DeleteSong()` uses `lock(MusicQueue)` — the other methods do not.
- `_loopMode` (line 19) is a non-volatile `bool` read from the `Loop()` background thread and written from `SetLoopMode()` on different threads. Reads may never observe writes without a memory barrier.

**Impact:** Data corruption in the linked list, skipped or double-played songs, stale loop mode state.

**Fix:** Use a single `lock` object (or `SemaphoreSlim`) for all queue and `NowPlaying` mutations. Mark `_loopMode` as `volatile` or use property with `lock`.

---

### C3. Thread-Safety — Race conditions in `UserManager`

**File:** `MusicParty/UserManager.cs` (line 9)

```csharp
private readonly List<User> _users = new();
```

`_users` is mutated by `CreateUser`, `LogoutAsync`, `RenameUserById`, and `BindMusicApiService`, and read by `FindUserById`. These are called from middleware (`PreprocessMiddleware`), the SignalR hub, and API controllers **concurrently**. No locking.

**Impact:** `ArgumentOutOfRangeException`, corrupted user list, phantom user entries.

**Fix:** Replace with `ConcurrentDictionary<string, User>` keyed by Id, or protect all accesses with `lock`.

---

### C4. Thread-Safety — Race conditions in `MusicProxyMiddleware`

**File:** `MusicParty/MusicProxyMiddleware.cs` (lines 5–10)

All state is static and shared across concurrent HTTP requests:
```csharp
private static CancellationTokenSource _tokenSource = new();
private static long _currentLength;
private static byte[]? _currentBuf;
private static long _read;
private static string? _currentMimeType;
```

- `_read` is written in a fire-and-forget `Task.Run` (line 103) and read in the request handler (line 69) without any memory barrier or volatile annotation.
- `_currentBuf` can be replaced by `StartProxyAsync` (line 101) while `InvokeAsync` is reading from it (lines 74, 78).
- `StartProxyAsync` cancels, disposes, and replaces `_tokenSource` (lines 87–89) while `InvokeAsync` may be checking `_tokenSource.IsCancellationRequested` (line 63).

**Impact:** `ObjectDisposedException`, buffer overrun, reading stale/corrupted data, serving bytes from a previous song mixed with a new song.

**Fix:** Use `Interlocked` for `_read`, use a per-request snapshot of the buffer reference, and synchronize `StartProxyAsync` vs `InvokeAsync`.

---

### C5. Security — Credentials logged to console in plaintext

**File:** `NeteaseCloudMusicApi/NeteaseCloudMusicApi.cs`

| Line | Code |
|------|------|
| 67 | `Console.WriteLine("cookie=="+cookie);` |
| 147 | `Console.WriteLine("cookie==="+File.ReadAllText("cookie.txt"));` |

Session cookies for the Netease Cloud Music account are printed to stdout on every startup and on every `GetPlayableMusicAsync` call.

**Impact:** Credentials visible in process logs, container logs, log aggregators. Full account takeover if logs are accessible.

**Fix:** Remove these lines entirely. If needed for debugging, use `ILogger` at `Debug` level with redaction.

---

### C6. Security — No URL encoding on user-supplied inputs (injection risk)

**Files:** `NeteaseCloudMusicApi/NeteaseCloudMusicApi.cs`, `QQMusicApi/QQMusicApi.cs`, `BilibiliApi/BilibiliApi.cs`

All API classes interpolate user-controlled strings directly into URLs without encoding:

| File | Example (line) |
|------|----------------|
| NeteaseCloudMusicApi.cs:187 | `$"/search?keywords={name}&limit=10&offset={0}"` |
| NeteaseCloudMusicApi.cs:205 | `$"/search?keywords={name}&limit=10&offset={offset}"` |
| NeteaseCloudMusicApi.cs:223 | `$"/search?type=1002&keywords={keyword}"` |
| QQMusicApi.cs:65 | `$"/search?key={name}"` |
| BilibiliApi.cs:75 | `$"...view?bvid={id}"` |
| BilibiliApi.cs:108 | `$"...search/type?search_type=bili_user&keyword={keyword}"` |

**Impact:** URL injection, SSRF, bypassing intended API endpoints. A crafted music ID like `foo&admin=true` would append arbitrary query parameters.

**Fix:** Use `Uri.EscapeDataString()` on all user-supplied values, or use `UriBuilder` / `HttpUtility.ParseQueryString`.

---

### C7. Security — `SetCred` endpoint has no authorization

**File:** `MusicParty/Controllers/ApiController.cs` (line 106)

```csharp
[HttpPost, Route("setcredential/{apiName}")]
public async Task<IActionResult> SetCred(string apiName, [FromBody] string? cred)
```

Unlike every other mutation endpoint, `SetCred` lacks the `[Authorize]` attribute. Any anonymous user can overwrite the API credentials used by the entire server, hijacking the music service account.

**Impact:** Unauthenticated credential replacement — full compromise of all music API sessions.

**Fix:** Add `[Authorize]` attribute. Consider an admin-only policy.

---

## High Severity

### H1. Blocking async calls — deadlock risk

**Files:**
| File | Line | Code |
|------|------|------|
| NeteaseCloudMusicApi.cs | 46 | `CheckCookieAsync(_cookie).Result` |
| NeteaseCloudMusicApi.cs | 86 | `_http.GetStringAsync(...).Result` |
| NeteaseCloudMusicApi.cs | 88 | `_http.GetStringAsync(...).Result` |
| NeteaseCloudMusicApi.cs | 94 | `Task.Delay(3000).Wait()` |
| NeteaseCloudMusicApi.cs | 95–96 | `_http.GetAsync(...).Result` / `.ReadAsStringAsync().Result` |
| BilibiliApi.cs | 24 | `SESSDATALogin(_sessdata).Wait()` |
| BilibiliApi.cs | 31 | `QRCodeLogin().Wait()` |
| QQMusicApi.cs | 15 | `Login(cookie).Wait()` |

`.Result` and `.Wait()` on async methods block the calling thread and can deadlock in ASP.NET's `SynchronizationContext`. These are called during startup from `Program.cs` (lines 28, 47).

**Fix:** Convert `Login()` to `async Task LoginAsync()` and use `await` throughout. For `Program.cs`, use `await api.LoginAsync()` (top-level statements support `await`).

---

### H2. Null-forgiving operator abuse — `NullReferenceException` risks

Pervasive use of `!` (null-forgiving) operator without prior null checks:

| File | Line | Expression |
|------|------|------------|
| MusicHub.cs | 31 | `Context.User!.Identity!.Name!` |
| MusicHub.cs | 42 | `_userManager.FindUserById(Context.User.Identity.Name!)!.Name` |
| MusicHub.cs | 106 | `_userManager.FindUserById(userId)!.Name` |
| MusicHub.cs | 191 | `_userManager.FindUserById(x.EnqueuerId)!.Name` |
| MusicHub.cs | 227 | `_userManager.FindUserById(x)!.Name` |
| MusicBroadcaster.cs | 64 | `_userManager.FindUserById(musicOrder.EnqueuerId)!.Name` |
| MusicBroadcaster.cs | 107 | `_userManager.FindUserById(enqueuerId)!.Name` |
| MusicBroadcaster.cs | 129 | `_userManager.FindUserById(operatorId)!.Name` |
| MusicBroadcaster.cs | 169 | `_userManager.FindUserById(operatorId)!.Name` |
| ApiController.cs | 28 | `_userManager.FindUserById(HttpContext.User.Identity!.Name!)!.Name` |
| ApiController.cs | 59 | `_userManager.FindUserById(HttpContext.User.Identity!.Name!)!` |
| ApiController.cs | 66 | `_userManager.FindUserById(HttpContext.User.Identity!.Name!)!` |
| PreprocessMiddleware.cs | 17 | `context.User.Identity!.Name` |

If `FindUserById` returns `null` (user removed by another thread, or stale cookie), any of these crash with `NullReferenceException` — an unhandled 500.

**Fix:** Add null checks / guard clauses before dereferencing. Return appropriate error responses when user is not found.

---

### H3. `NullReferenceException` in `Program.cs` configuration reads

**File:** `MusicParty/Program.cs` (lines 21, 32, 41)

```csharp
bool.Parse(builder.Configuration["MusicApi:NeteaseCloudMusic:Enabled"])
```

`builder.Configuration[...]` returns `null` when the key is missing. `bool.Parse(null)` throws `ArgumentNullException`. The same pattern is used for `ApiServerUrl`, `PhoneNo`, `Cookie` — passing `null` to constructors.

**Fix:** Use `builder.Configuration.GetValue<bool>(...)` which handles defaults, or add null checks with descriptive error messages.

---

### H4. `HttpClient` misuse — resource leaks and conflicting cookie behavior

| File | Issue |
|------|-------|
| NeteaseCloudMusicApi.cs:76–78 | `CheckCookieAsync` creates `new HttpClient()` per call, never disposes it. Socket exhaustion risk. |
| QQMusicApi.cs:29 | `CheckCookieAsync` creates `new HttpClient()` per call, never disposes it. |
| BilibiliApi.cs:49 | `CheckSESSDATAAsync` creates `new HttpClient()` per call, never disposes it. |
| NeteaseCloudMusicApi.cs:13 | `HttpClient` created with `UseCookies = true` but also manually sets `Cookie` header — conflicting behavior. |
| MusicProxyMiddleware.cs:99 | `HttpResponseMessage` from `SendAsync` is never disposed — connection held open. |

**Fix:** Use `IHttpClientFactory` registered in DI. Dispose `HttpResponseMessage`. Set `UseCookies = false` when manually managing cookies.

---

### H5. Unbounded memory allocation in proxy

**File:** `MusicParty/MusicProxyMiddleware.cs` (line 101)

```csharp
_currentBuf = new byte[_currentLength];
```

`_currentLength` is read from `Content-Length` header of an upstream HTTP response. No size limit is enforced. A malicious or misconfigured upstream could return a multi-gigabyte `Content-Length`, causing `OutOfMemoryException` and crashing the process.

**Fix:** Add a maximum allowed size (e.g., 500MB) and reject responses exceeding it.

---

### H6. Broken `url.Replace("http", "https")` 

**Files:**
- `NeteaseCloudMusicApi/NeteaseCloudMusicApi.cs` (line 158)
- `QQMusicApi/QQMusicApi.cs` (line 108)

```csharp
return new PlayableMusic(music) { Url = url.Replace("http", "https"), ... };
```

`String.Replace("http", "https")` replaces **all** occurrences, including the "http" inside "https", producing `"httpss://..."`. This silently breaks playback URLs.

**Fix:** Use `url.Replace("http://", "https://")` instead.

---

### H7. Incorrect `Console.WriteLine` format strings — messages not logged properly

**File:** `MusicParty/Hub/MusicHub.cs`

| Line | Code | Problem |
|------|------|---------|
| 133 | `Console.WriteLine("Failed to enqueue music, id: {id}", ex)` | `{id}` is not a format placeholder — the literal string `{id}` is printed. The `ex` is passed as first format arg, overwriting `{id}` position. |
| 171 | `Console.WriteLine("Failed to enqueue music, name: {name}", ex)` | Same issue. |
| 181 | `Console.WriteLine("start===SetNowPlaying", music)` | `music` argument is silently ignored — `Console.WriteLine(string, object)` only processes format placeholders `{0}`, `{1}`, etc. |

**File:** `NeteaseCloudMusicApi/NeteaseCloudMusicApi.cs`

| Line | Code | Problem |
|------|------|---------|
| 23 | `Console.WriteLine("url",url)` | `url` argument silently ignored. |

**Fix:** Use string interpolation `$"..."` or structured logging via `ILogger`.

---

### H8. Duplicate `DeleteSong` / `DelSong` functionality

**File:** `MusicParty/MusicBroadcaster.cs`

Two methods do the same thing:
- `DelSong` (lines 132–139) — uses `MusicQueue.RemoveByPredicate()`, notifies clients
- `DeleteSong` (lines 228–240) — uses `lock(MusicQueue)` and `MusicQueue.Remove()`, no client notification

Both are called from `MusicHub`:
- `MusicHub.DelSong()` (line 207) calls `_musicBroadcaster.DelSong()`
- `MusicHub.DeleteSong()` (line 438) calls `_musicBroadcaster.DeleteSong()`

**Impact:** Confusing API surface, inconsistent client notification, inconsistent locking (only `DeleteSong` locks).

**Fix:** Remove one method. Consolidate into a single `RemoveSong` method with proper locking and notification.

---

## Medium Severity

### M1. Spin-wait polling in `MusicProxyMiddleware`

**File:** `MusicParty/MusicProxyMiddleware.cs` (lines 69–70)

```csharp
while (i >= _read)
    await Task.Delay(10);
```

Busy-wait loop with 10ms polling. Wastes CPU and adds up to 10ms latency per byte chunk.

**Fix:** Use `SemaphoreSlim`, `ManualResetEventSlim`, or `Channel<T>` for producer-consumer signaling.

---

### M2. `DateTime.Now` instead of `DateTime.UtcNow`

**File:** `MusicParty/MusicBroadcaster.cs` (lines 62, 83, 93)

```csharp
NowPlayingStartedTime = DateTime.Now;
(DateTime.Now - NowPlayingStartedTime).TotalMilliseconds >= NowPlaying.Value.music.Length
(DateTime.Now - _musicBroadcaster.NowPlayingStartedTime).TotalSeconds
```

`DateTime.Now` is affected by DST transitions and timezone changes, which can cause songs to end prematurely or play indefinitely during a DST switch.

**Fix:** Use `DateTime.UtcNow` or `Stopwatch` for elapsed-time measurements.

---

### M3. Cookie stored in plaintext file with hardcoded relative path

**File:** `NeteaseCloudMusicApi/NeteaseCloudMusicApi.cs` (lines 33, 69, 146, 167)

```csharp
File.Exists("cookie.txt")
File.WriteAllText("cookie.txt", cookie)
File.ReadAllText("cookie.txt")
```

- Cookie/session credential stored as unencrypted plaintext.
- Relative path depends on working directory — may read/write wrong file.
- `File.ReadAllText` called on **every** `GetPlayableMusicAsync` invocation (line 146) — unnecessary I/O.
- No file locking — concurrent access from multiple threads could corrupt.

**Fix:** Store credentials via ASP.NET's Data Protection API or encrypted configuration. Cache cookie in memory instead of re-reading from disk.

---

### M4. `public bool _loopMode` — encapsulation violation

**File:** `MusicParty/MusicBroadcaster.cs` (line 19)

```csharp
public bool _loopMode = true;
```

Public field with private naming convention (`_` prefix). Accessed directly from `MusicHub.RequestLoopModeStatus()` (line 435).

**Fix:** Change to `public bool LoopMode { get; private set; } = true;` with proper property naming.

---

### M5. Authentication cookie with infinite expiry

**File:** `MusicParty/UserManager.cs` (line 30)

```csharp
ExpiresUtc = DateTimeOffset.MaxValue
```

Cookies that never expire persist indefinitely. Combined with the 8-char GUID ID, this creates a permanent session with a guessable identifier.

**Fix:** Set a reasonable expiry (e.g., 24 hours) and implement session refresh logic.

---

### M6. GUID truncation — collision risk

**Files:**
- `MusicParty/PreprocessMiddleware.cs` (lines 20, 27): `Guid.NewGuid().ToString()[..8]`
- `MusicParty/MusicBroadcaster.cs` (line 105): `Guid.NewGuid().ToString()[..8]`

Truncating a GUID to 8 hex characters reduces the ID space from 2^122 to 2^32 (~4 billion). With the birthday paradox, collision probability reaches 50% at ~77,000 IDs.

**Fix:** Use the full GUID, or use a purpose-built short-ID generator with collision detection.

---

### M7. Code duplication — `SearchMusicByNameAsync` vs `GetMusicListByName`

**File:** `NeteaseCloudMusicApi/NeteaseCloudMusicApi.cs`

- `SearchMusicByNameAsync` (lines 185–199) and `GetMusicListByName` (lines 203–218) call the same endpoint (`/search?keywords=...`) with nearly identical parsing logic. Only the return type differs (`Music` vs `PlayList`).

**Fix:** Extract shared HTTP call + JSON parsing into a private helper. Map to different result types in the public methods.

---

### M8. `NotImplementedException` in production code

| File | Method |
|------|--------|
| `QQMusicApi/QQMusicApi.cs:112` | `SearchUserAsync` |
| `BilibiliApi/BilibiliApi.cs:83` | `SearchMusicByNameAsync` |
| `BilibiliApi/BilibiliApi.cs:57` | `QRCodeLogin` |

These throw `NotImplementedException` at runtime. If any client calls these methods, the application crashes with an unhandled exception.

**Fix:** Return empty collections or throw `NotSupportedException` with descriptive messages. Guard at the call site.

---

### M9. Missing `CancellationToken` propagation

All async methods across every file accept no `CancellationToken` parameter and do not pass `HttpContext.RequestAborted` to downstream HTTP calls. This means:
- Client disconnects don't cancel upstream API requests.
- Application shutdown doesn't gracefully cancel in-flight operations.

**Fix:** Accept `CancellationToken` in `IMusicApi` interface methods and propagate to all `HttpClient` calls.

---

### M10. DI anti-patterns in `Program.cs`

**File:** `MusicParty/Program.cs` (lines 20–55)

- Music APIs are manually `new`-ed instead of registered through DI.
- `MusicBroadcaster` starts a background task in its constructor (line 27). Constructors should not start async work — use `IHostedService.StartAsync` instead.
- `IHttpContextAccessor` is used in `UserManager` to access `HttpContext` — this is a code smell in a singleton service.

**Fix:** Register API implementations via `AddSingleton<IMusicApi, NeteaseCloudMusicApi>()`. Convert `MusicBroadcaster` to `BackgroundService`.

---

### M11. `BilibiliApi.GetMusicListByName` — broken logic

**File:** `BilibiliApi/BilibiliApi.cs` (line 145)

```csharp
$"...list-all?type=2&up_mid={name+offset}"
```

`name` (a search query) is concatenated with `offset` (an integer) and passed as `up_mid` (a user ID parameter). This produces nonsensical API calls.

**Fix:** Implement proper search-by-name logic for Bilibili, or throw `NotSupportedException`.

---

### M12. Unused HTTP request in `QQMusicApi.GetUserPlayListAsync`

**File:** `QQMusicApi/QQMusicApi.cs` (lines 145–146)

```csharp
var resp3 = await _http.GetStringAsync(_url + $"/user/detail?id={userIdentifier}");
Console.WriteLine($"Response 3: {resp3}");
```

The third API call result is fetched and logged but never used. Wasted network call.

**Fix:** Remove the dead code.

---

### M13. `EnqueueMusicByName` — broken randomization logic

**File:** `MusicParty/Hub/MusicHub.cs` (lines 138–175)

```csharp
int listCount = musicList.Count()-1;      // enumerates collection
int radomCount = 3;
if(listCount < 3){ radomCount = listCount; }
int k=rd.Next(1,radomCount);              // generates random index but...
musicEnumerator.MoveNext();               // always takes first element
var music = musicEnumerator.Current;       // variable k is unused
```

Issues:
1. `musicList.Count()` enumerates the entire `IEnumerable` (potential double-enumeration).
2. `k` is computed but never used — the for-loop advancing the enumerator is commented out (lines 158–161).
3. Always selects the first search result regardless of `k`.
4. `musicEnumerator` is not disposed.
5. `radomCount` typo (should be `randomCount`).

**Fix:** Use `musicList.ToList()`, then index with `list[k]`. Dispose the enumerator.

---

## Low Severity

### L1. Return type `dynamic` in `BuildResponseMessageWithCode`

**File:** `MusicParty/Extensions.cs` (line 18)

```csharp
public static dynamic BuildResponseMessageWithCode(this string message, int code)
```

Returning `dynamic` loses compile-time type safety. This is used in `ApiController` to build error responses.

**Fix:** Define a `record ApiResponse(int Code, string Message)` and return that instead.

---

### L2. Commented-out code

**File:** `MusicParty/Hub/MusicHub.cs`

| Lines | Content |
|-------|---------|
| 146–147 | `//Console.WriteLine("musicList", musicList);` |
| 158–161 | Commented-out for-loop that was supposed to advance enumerator |

**Fix:** Remove dead code.

---

### L3. Debug `Console.WriteLine` scattered throughout production code

Across the codebase, there are **25+** `Console.WriteLine` calls used for debugging that should not be in production:

| File | Approximate count |
|------|-------------------|
| NeteaseCloudMusicApi.cs | 10 |
| QQMusicApi.cs | 5 |
| MusicHub.cs | 6 |
| BilibiliApi.cs | 1 |
| MusicBroadcaster.cs | 1 |

**Fix:** Replace with `ILogger` calls at appropriate log levels. Remove console debug output.

---

### L4. String interpolation in `ILogger` calls

**File:** `MusicParty/Hub/MusicHub.cs` (lines 48, 64, 111, 316, 323, etc.)

```csharp
_logger.LogInformation($"原大魔王 {Context.User.Identity.Name!} 重新连接...");
```

Using `$"..."` string interpolation with `ILogger` defeats structured logging — the message template cannot be parsed by log aggregators, and the string is always allocated even if the log level is disabled.

**Fix:** Use message templates: `_logger.LogInformation("User {UserId} reconnected...", userId);`

---

### L5. Inconsistent async method naming

**File:** `MusicApiContract/IMusicApi.cs` (line 13)

```csharp
Task<IEnumerable<PlayList>> GetMusicListByName(string name, int offset = 0);
```

All other `Task`-returning methods follow the `*Async` suffix convention. `GetMusicListByName` does not.

**Fix:** Rename to `GetMusicListByNameAsync`.

---

### L6. Duplicate `User` record definition

- `MusicParty/User.cs` (line 3): `public record User(string Id, string Name, Dictionary<...>)`
- `MusicParty/Hub/MusicHub.cs` (line 223): `public record User(string Id, string Name)`

Two types named `User` in different scopes. The hub's inner `User` shadows the outer one. Confusing for maintainers.

**Fix:** Rename the hub's DTO to `OnlineUserDto` or similar.

---

### L7. Magic strings for authentication scheme

- `UserManager.cs` (lines 28, 37): `"Cookies"`
- `Program.cs` (line 58): `"Cookies"`
- `PreprocessMiddleware.cs`: implicit via cookie auth

**Fix:** Define `const string CookieScheme = "Cookies";` in a shared constants class.

---

### L8. `new Random()` created per-call

**File:** `MusicParty/Hub/MusicHub.cs` (lines 51, 148, 342, 377)

Multiple `new Random()` instances created in method scope. In .NET 6+ this is not a correctness issue (they are seeded differently), but it's wasteful.

**Fix:** Use `Random.Shared` (available in .NET 6+).

---

### L9. Missing HTTP response status code checks

**Files:** `NeteaseCloudMusicApi.cs`, `QQMusicApi.cs`, `BilibiliApi.cs`

All API calls use `GetStringAsync` which throws on non-2xx status codes, but the exception message won't include the response body. If the upstream API returns a 4xx/5xx with a JSON error body, the error details are lost.

**Fix:** Use `SendAsync` + `EnsureSuccessStatusCode()`, or read the response body before checking the HTTP status to include details in error messages.

---

### L10. Hardcoded User-Agent and Referer strings

**File:** `MusicParty/MusicBroadcaster.cs` (line 59)

```csharp
"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ..."
```

**File:** `MusicParty/MusicProxyMiddleware.cs` (line 96)

```csharp
message.Headers.UserAgent.ParseAdd(req.UserAgent ?? "Mozilla/5.0");
```

**Fix:** Move to configuration.

---

## Summary

| Severity | Count | Key Themes |
|----------|-------|------------|
| **Critical** | 7 | Thread safety (4), credential exposure (1), URL injection (1), unauthenticated endpoint (1) |
| **High** | 8 | Blocking async (1), null safety (2), HttpClient misuse (1), memory (1), broken URL replace (1), broken logging (1), duplicate code (1) |
| **Medium** | 13 | Spin-wait (1), DateTime (1), file I/O (1), encapsulation (1), session security (1), GUID collision (1), code duplication (1), unimplemented methods (1), cancellation (1), DI (1), broken logic (2), dead code (1) |
| **Low** | 10 | Type safety (1), dead code (1), debug logging (1), structured logging (1), naming (2), magic strings (1), Random (1), error handling (1), hardcoded values (1) |

### Top 5 Recommendations (by impact)

1. **Add thread synchronization** to `MusicHub`, `MusicBroadcaster`, `UserManager`, and `MusicProxyMiddleware`. This is the most impactful change — the current code has data corruption bugs under any concurrent load.
2. **Remove credential logging** and add `[Authorize]` to `SetCred`. These are immediate security wins.
3. **URL-encode all user inputs** in API URL construction to prevent injection attacks.
4. **Fix `url.Replace("http", "https")`** to `url.Replace("http://", "https://")` — this is silently breaking all playback URLs.
5. **Convert blocking `.Result`/`.Wait()` calls** to proper `async`/`await` to prevent potential deadlocks.
