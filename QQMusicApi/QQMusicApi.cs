using System.Text.Json.Nodes;

namespace MusicParty.MusicApi.QQMusic;

public class QQMusicApi : IMusicApi
{
    private readonly string _url;
    private readonly HttpClient _http = new();

    public QQMusicApi(string url, string cookie)
    {
        _url = url;
        Console.WriteLine("You are going to login your QQ music account using cookie...");
        Login(cookie).Wait();
        Console.WriteLine("Login success.");
    }

    private async Task Login(string cookie)
    {
        if (string.IsNullOrEmpty(cookie))
            throw new LoginException("Set your cookie in appsettings.json");
        if (!await CheckCookieAsync(cookie))
            throw new LoginException("Login failed, check your cookie.");
        _http.DefaultRequestHeaders.Add("Cookie", cookie);
    }

    private async Task<bool> CheckCookieAsync(string cookie)
    {
        var http = new HttpClient();
        http.DefaultRequestHeaders.Add("Cookie", cookie);
        var resp = await http.GetStringAsync($"{_url}/recommend/daily");
        var j = JsonNode.Parse(resp)!;
        return j["result"]!.GetValue<int>() != 301;
    }

    public string ServiceName => "QQMusic";

    public async Task<bool> TrySetCredentialAsync(string cred)
    {
        if (await CheckCookieAsync(cred))
        {
            _http.DefaultRequestHeaders.Remove("Cookie");
            _http.DefaultRequestHeaders.Add("Cookie", cred);
            return true;
        }
        else
            return false;
    }

    public async Task<Music> GetMusicByIdAsync(string id)
    {
        var ids = id.Split(',');
        var resp = await _http.GetStringAsync(_url + $"/song?songmid={ids[0]}");
        var j = JsonNode.Parse(resp)!;
        if (j["result"]!.GetValue<int>() != 100)
            throw new Exception($"Unable to get music, message: {resp}");
        var name = j["data"]!["track_info"]!["name"]!.GetValue<string>();
        var artists = j["data"]!["track_info"]!["singer"]!.AsArray()
            .Select(x => x!["name"]!.GetValue<string>()).ToArray();
        return new Music(id, name, artists);
    }

    public async Task<IEnumerable<Music>> SearchMusicByNameAsync(string name)
    {
       var resp1 = await _http.GetStringAsync(_url + $"/search?key={name}");

        Console.WriteLine($"GetMusicListByName  resp1: {resp1}");

        var j1 = JsonNode.Parse(resp1)!;
        if (j1["result"]!.GetValue<int>() != 100)
            throw new Exception($"Unable to get user playlist, message: ${resp1}");
        var musics = j1["data"]!["list"]!.AsArray()
            .Select(x =>
            {
                var artists = x!["singer"]!.AsArray().Select(y => y!["name"]!.GetValue<string>()).ToArray();
                return new Music(x["songmid"]!.GetValue<string>() + ',' + x["strMediaMid"]!.GetValue<string>(),
                    x["songname"]!.GetValue<string>(), artists);
            });
        return musics;
    }

    public async Task<PlayableMusic> GetPlayableMusicAsync(Music music)
    {
        var ids = music.Id.Split(',');
        var resp1 = await _http.GetStringAsync(_url + $"/song?songmid={ids[0]}");
        var j1 = JsonNode.Parse(resp1)!;

        Console.WriteLine("GetPlayableMusicAsync.j1" + j1);

        if (j1["result"]!.GetValue<int>() != 100)
            throw new Exception($"Unable to get playable music, message: {resp1}");
        var length = j1["data"]!["track_info"]!["interval"]!.GetValue<int>() * 1000;
        string url;
        var resp2 = await _http.GetStringAsync(_url + $"/song/url?id={ids[0]}&mediaId={ids[1]}&type=320");
        var j2 = JsonNode.Parse(resp2)!;
        if (j2["result"]!.GetValue<int>() != 100 || string.IsNullOrEmpty(j2["data"]!.GetValue<string>()))
        {
            var resp3 = await _http.GetStringAsync(_url +
                                                   $"/song/url?id={ids[0]}&mediaId={ids[1]}"); // no 320 mp3, try 128
            var j3 = JsonNode.Parse(resp3)!;
            if (j3["result"]!.GetValue<int>() != 100 || string.IsNullOrEmpty(j3["data"]!.GetValue<string>()))
                throw new Exception($"Unable to get playable music, message: {resp2}");
            url = j3["data"]!.GetValue<string>();
        }
        else
            url = j2["data"]!.GetValue<string>();

        return new PlayableMusic(music) { Url = url.Replace("http", "https"), Length = length };
    }

    public async Task<IEnumerable<MusicServiceUser>> SearchUserAsync(string keyword)
    {
        throw new NotImplementedException();
    }

    public async Task<IEnumerable<PlayList>> GetUserPlayListAsync(string userIdentifier)
    {
        var resp1 = await _http.GetStringAsync(_url + $"/user/songlist?id={userIdentifier}");
        Console.WriteLine($"Response 1: {resp1}");
        var j1 = JsonNode.Parse(resp1);
        if (j1?["result"]?.GetValue<int>() != 100)
            throw new Exception($"Unable to get user playlist, message: ${resp1}");

        var playlists1 = j1["data"]?["list"]?.AsArray()
            .Select(x => new PlayList(
                x?["tid"]?.GetValue<long>().ToString() ?? string.Empty,
                x?["diss_name"]?.GetValue<string>() ?? string.Empty))
            .Where(x => !string.IsNullOrEmpty(x.Id) && x.Id != "0")
            ?? Enumerable.Empty<PlayList>();

        var resp2 = await _http.GetStringAsync(_url + $"/user/collect/songlist?id={userIdentifier}");
        Console.WriteLine($"Response 2: {resp2}");

        var j2 = JsonNode.Parse(resp2);
        if (j2?["result"]?.GetValue<int>() != 100)
            throw new Exception($"Unable to get user collected playlist, message: ${resp2}");

        var playlists2 = j2["data"]?["list"]?.AsArray()
            .Select(x => new PlayList(
                x?["dissid"]?.GetValue<long>().ToString() ?? string.Empty,
                x?["dissname"]?.GetValue<string>() ?? string.Empty))
            ?? Enumerable.Empty<PlayList>();


        var resp3 = await _http.GetStringAsync(_url + $"/user/detail?id={userIdentifier}");
        Console.WriteLine($"Response 3: {resp3}");


        return playlists1.Concat(playlists2);
    }

    public async Task<IEnumerable<Music>> GetMusicsByPlaylistAsync(string id, int offset = 0)
    {
        var resp = await _http.GetStringAsync(_url + $"/songlist?id={id}");
        var j = JsonNode.Parse(resp)!;
        if (j["result"]!.GetValue<int>() != 100)
            throw new Exception($"Unable to get playlist musics, message: {resp}");
        var musics = j["data"]!["songlist"]!.AsArray()
            .Select(x =>
            {
                var artists = x!["singer"]!.AsArray().Select(y => y!["name"]!.GetValue<string>()).ToArray();
                return new Music(x["songmid"]!.GetValue<string>() + ',' + x["strMediaMid"]!.GetValue<string>(),
                    x["songorig"]!.GetValue<string>(), artists);
            });
        return musics.Skip(offset).Take(10);
    }

     public async Task<IEnumerable<PlayList>> GetMusicListByName(string name, int offset = 0)
    {
        var resp1 = await _http.GetStringAsync(_url + $"/search?key={name}");

        Console.WriteLine($"GetMusicListByName  resp1: {resp1}");

        var j1 = JsonNode.Parse(resp1)!;
        if (j1["result"]!.GetValue<int>() != 100)
            throw new Exception($"Unable to get user playlist, message: ${resp1}");
        var playlists1 = j1["data"]!["list"]!.AsArray()
            .Select(x => {
            var songId = x?["songmid"]?.GetValue<string>() ?? string.Empty;
            var strMediaMid = x?["strMediaMid"]?.GetValue<string>() ?? string.Empty;
            var songName = x?["songname"]?.GetValue<string>() ?? string.Empty;
            var singerName = x?["singer"]?.AsArray()?.FirstOrDefault()?["name"]?.GetValue<string>() ?? string.Empty;
            var combinedName = $"{songName} - {singerName}";
            return new PlayList(
                songId + ',' + strMediaMid,
                combinedName
            );
        }) ?? Enumerable.Empty<PlayList>();

        return playlists1;
    }
}