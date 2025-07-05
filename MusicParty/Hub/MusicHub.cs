using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using MusicParty.MusicApi;

namespace MusicParty.Hub;

[Authorize]
public class MusicHub : Microsoft.AspNetCore.SignalR.Hub
{
    private static HashSet<string> OnlineUsers { get; } = new();
    private static List<string> DuplicatedConnectionIds { get; } = new();
    private static Queue<(string name, string content)> Last5Chat { get; } = new();
    private static string? CurrentDemonLord { get; set; } = null; // 当前大魔王
    private readonly IEnumerable<IMusicApi> _musicApis;
    private readonly MusicBroadcaster _musicBroadcaster;
    private readonly UserManager _userManager;
    private readonly ILogger<MusicHub> _logger;

    public MusicHub(IEnumerable<IMusicApi> musicApis, MusicBroadcaster musicBroadcaster,
        UserManager userManager,
        ILogger<MusicHub> logger)
    {
        _musicApis = musicApis;
        _musicBroadcaster = musicBroadcaster;
        _userManager = userManager;
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        if (OnlineUsers.Contains(Context.User!.Identity!.Name!)) // don't allow login twice
        {
            DuplicatedConnectionIds.Add(Context.ConnectionId);
            await Clients.Caller.SendAsync("Abort", "You have already logged in.");
            Context.Abort();
            return;
        }

        OnlineUsers.Add(Context.User.Identity.Name!);
        
        // 检查是否是大魔王登录
        var userName = _userManager.FindUserById(Context.User.Identity.Name!)!.Name;
        if (userName == "大魔王")
        {
            if (CurrentDemonLord != null && CurrentDemonLord != Context.User.Identity.Name!)
            {
                // 已有其他大魔王在线，将当前用户降级为前大魔王
                _logger.LogInformation($"原大魔王 {Context.User.Identity.Name!} 重新连接，但已有新大魔王 {CurrentDemonLord}，自动降级");
                
                // 生成前大魔王名称
                var random = new Random();
                var newName = $"前大魔王_{random.Next(1000, 9999)}";
                
                // 更新用户名
                _userManager.RenameUserById(Context.User.Identity.Name!, newName);
                
                // 通知用户被降级
                await Clients.Caller.SendAsync("NewChat", "系统", $"您已被新大魔王夺权，新名字：{newName}");
                await Clients.All.SendAsync("NewChat", "系统", $"😈 原大魔王 {newName} 重新连接了！");
                
                // 通知所有客户端更新用户名
                await OnlineUserRename(Context.User.Identity.Name!);
                
                _logger.LogInformation($"原大魔王降级为: {newName}");
            }
            else if (CurrentDemonLord == null)
            {
                // 没有大魔王在线，设置当前大魔王
                CurrentDemonLord = Context.User.Identity.Name!;
                _logger.LogInformation($"设置大魔王: {Context.User.Identity.Name!}");
                await Clients.All.SendAsync("NewChat", "系统", "🔥 大魔王降临了！");
            }
            else
            {
                // 当前大魔王重新连接
                _logger.LogInformation($"大魔王 {Context.User.Identity.Name!} 重新连接");
            }
        }
        
        await OnlineUserLogin(Clients.Others, Context.User.Identity.Name!);
        if (Last5Chat.Count > 0)
        {
            foreach (var chat in Last5Chat)
            {
                await NewChat(Clients.Caller, chat.name, chat.content);
            }
        }

        if (_musicBroadcaster.NowPlaying is not null)
        {
            var (music, service, enqueuerId) = _musicBroadcaster.NowPlaying.Value;
            await SetNowPlaying(Clients.Caller, music, _userManager.FindUserById(enqueuerId)!.Name,
                (int)(DateTime.Now - _musicBroadcaster.NowPlayingStartedTime).TotalSeconds);
        }
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (DuplicatedConnectionIds.Contains(Context.ConnectionId))
        {
            DuplicatedConnectionIds.Remove(Context.ConnectionId);
            return;
        }

        var userId = Context.User!.Identity!.Name!;
        var userName = _userManager.FindUserById(userId)!.Name;
        
        // 检查是否是大魔王登出
        if (userName == "大魔王" && CurrentDemonLord == userId)
        {
            _logger.LogInformation($"大魔王 {userId} 断开连接，清除大魔王状态");
            CurrentDemonLord = null;
            await Clients.All.SendAsync("NewChat", "系统", "😈 大魔王离开了...");
        }
        
        OnlineUsers.Remove(userId);
        await OnlineUserLogout(userId);
    }

    #region Remote invokable

    public async Task EnqueueMusic(string id, string apiName)
    {
        if (!_musicApis.TryGetMusicApi(apiName, out var ma))
            throw new HubException($"Unknown api provider {apiName}.");
        try
        {
            var music = await ma!.GetMusicByIdAsync(id);
            await _musicBroadcaster.EnqueueMusic(music, apiName, Context.User!.Identity!.Name!);
        }
        catch (Exception ex)
        {
            Console.WriteLine("Failed to enqueue music, id: {id}", ex);
            throw new HubException($"Failed to enqueue music, id: {id}", ex);
        }
    }

    public async Task EnqueueMusicByName(string name, string apiName)
    {
        if (!_musicApis.TryGetMusicApi(apiName, out var ma))
            throw new HubException($"Unknown api provider {apiName}.");
        try
        {
            var musicList = await ma!.SearchMusicByNameAsync(name);

            //Console.WriteLine("musicList", musicList);
            Console.WriteLine("musicList.Count()"+musicList.Count());
            Random rd=new Random();
            int listCount = musicList.Count()-1;
            int radomCount = 3;
            if(listCount < 3){
                radomCount = listCount;
            }
            int k=rd.Next(1,radomCount);
            Console.WriteLine("k"+k);
                        
            IEnumerator<Music> musicEnumerator = musicList.GetEnumerator(); 
            // for (int a = 0; a < k; a = a + 1)
            //     {
                    musicEnumerator.MoveNext();
                // }
            var music = musicEnumerator.Current;
            Console.WriteLine("music"+music);
            Console.WriteLine("music.Id"+music.Id);
            var currentMusic = await ma!.GetMusicByIdAsync(music.Id);

            Console.WriteLine("currentMusic"+currentMusic);
            await _musicBroadcaster.EnqueueMusic(currentMusic, apiName, Context.User!.Identity!.Name!);
        }
        catch (Exception ex)
        {
            Console.WriteLine("Failed to enqueue music, name: {name}", ex);
            throw new HubException($"Failed to enqueue music, name: {name}", ex);
        }
    }

    public async Task RequestSetNowPlaying()
    {
        if (_musicBroadcaster.NowPlaying is null) return;
        var (music, service, enqueuerId) = _musicBroadcaster.NowPlaying.Value;
        Console.WriteLine("start===SetNowPlaying", music);
        await SetNowPlaying(Clients.Caller, music, _userManager.FindUserById(enqueuerId)!.Name,
            (int)(DateTime.Now - _musicBroadcaster.NowPlayingStartedTime).TotalSeconds);
    }

    public record MusicEnqueueOrder(string ActionId, Music Music, string EnqueuerName);

    public IEnumerable<MusicEnqueueOrder> GetMusicQueue()
    {
        return _musicBroadcaster.GetQueue().Select(x =>
            new MusicEnqueueOrder(x.ActionId, x.Music, _userManager.FindUserById(x.EnqueuerId)!.Name)).ToList();
    }

    public async Task NextSong()
    {

         await _musicBroadcaster.NextSong(Context.User!.Identity!.Name!);
    }

    public async Task TopSong(string actionId)
    {
        await _musicBroadcaster.TopSong(actionId, Context.User!.Identity!.Name!);
    }

    public async Task DelSong(string actionId)
    {
        await _musicBroadcaster.DelSong(actionId, Context.User!.Identity!.Name!);
    }

    public async Task Rename(string newName)
    {
        // 检查是否试图改成大魔王
        if (newName.Trim() == "大魔王")
        {
            await Clients.Caller.SendAsync("NewChat", "系统", "❌ 不能直接改名为大魔王！只有通过 roll 100 才能成为大魔王！");
            return;
        }
        
        _userManager.RenameUserById(Context.User!.Identity!.Name!, newName);
        await OnlineUserRename(Context.User.Identity.Name!);
    }

    public record User(string Id, string Name);

    public IEnumerable<User> GetOnlineUsers()
    {
        return OnlineUsers.Select(x => new User(x, _userManager.FindUserById(x)!.Name)).ToList();
    }

    public async Task ChatSay(string content)
    {
        var currentUserId = Context.User!.Identity!.Name!;
        var currentUserName = _userManager.FindUserById(currentUserId)!.Name;
        
        // 检查是否是 roll 命令
        if (content.Trim().ToLower() == "roll" || content.Trim().ToLower() == "/roll")
        {
            await HandleRollCommand(currentUserId, currentUserName);
            return;
        }
        
        // 检查是否是踢人命令
        if (content.Trim().StartsWith("kick ass ") || content.Trim().StartsWith("/kick ass "))
        {
            // 检查权限：只有大魔王才能踢人
            if (currentUserName != "大魔王" || CurrentDemonLord != currentUserId)
            {
                await Clients.Caller.SendAsync("NewChat", "系统", "❌ 只有大魔王才能使用踢人功能！");
                return;
            }
            
            var targetUserName = content.Trim().Replace("/kick ass ", "").Replace("kick ass ", "").Trim();
            
            // 不能踢出自己
            if (targetUserName == "大魔王")
            {
                await Clients.Caller.SendAsync("NewChat", "系统", "❌ 大魔王不能踢出自己！");
                return;
            }
            
            // 检查目标用户是否存在
            var targetUser = OnlineUsers.FirstOrDefault(u => 
                _userManager.FindUserById(u)?.Name == targetUserName);
            
            if (targetUser != null)
            {
                // 踢出目标用户
                await KickUser(targetUser, currentUserName, targetUserName);
                return;
            }
            else
            {
                // 用户不存在，发送错误消息
                await Clients.Caller.SendAsync("NewChat", "系统", $"用户 '{targetUserName}' 不存在或已离线");
                return;
            }
        }
        
        // 正常聊天消息
        while (Last5Chat.Count >= 5) Last5Chat.Dequeue();
        Last5Chat.Enqueue((currentUserName, content));
        await NewChat(Clients.All, currentUserName, content);
    }

    #endregion

    private async Task SetNowPlaying(IClientProxy target, PlayableMusic music, string enqueuerName, int playedTime)
    {
        await target.SendAsync(nameof(SetNowPlaying), music, enqueuerName, playedTime);
    }

    private async Task OnlineUserLogin(IClientProxy target, string id)
    {
        await target.SendAsync(nameof(OnlineUserLogin), id, _userManager.FindUserById(id)!.Name);
    }

    private async Task OnlineUserLogout(string id)
    {
        await Clients.All.SendAsync(nameof(OnlineUserLogout), id);
    }

    private async Task OnlineUserRename(string id)
    {
        await Clients.All.SendAsync(nameof(OnlineUserRename), id, _userManager.FindUserById(id)!.Name);
    }

    private async Task NewChat(IClientProxy target, string name, string content)
    {
        await target.SendAsync(nameof(NewChat), name, content);
    }
    
    private async Task KickUser(string targetUserId, string operatorName, string targetUserName)
    {
        try
        {
            _logger.LogInformation($"开始踢出用户: {targetUserName} (ID: {targetUserId})");
            
            // 通知所有用户有人被踢出
            await Clients.All.SendAsync("NewChat", "系统", $"{operatorName} 踢出了 {targetUserName}");
            
            // 从在线用户列表中移除被踢用户
            var removed = OnlineUsers.Remove(targetUserId);
            _logger.LogInformation($"用户移除结果: {removed}, 剩余在线用户数量: {OnlineUsers.Count}");
            
            // 通知所有客户端用户离线
            await OnlineUserLogout(targetUserId);
            
            // 发送踢出消息给所有客户端
            await Clients.All.SendAsync("KickUser", targetUserName, $"您已被 {operatorName} 踢出房间");
            
            _logger.LogInformation($"用户 {operatorName} 成功踢出了用户 {targetUserName}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"踢出用户 {targetUserName} 时发生错误");
            await Clients.Caller.SendAsync("NewChat", "系统", $"踢出用户 {targetUserName} 失败");
        }
    }
    
    private async Task HandleRollCommand(string userId, string userName)
    {
        var random = new Random();
        int rollResult;
        
        // 勇者的小作弊：必然出100
        if (userName == "勇者")
        {
            rollResult = 100;
        }
        else
        {
            rollResult = random.Next(1, 101); // 生成1-100的随机数
            await Clients.All.SendAsync("NewChat", "🎲 骰子", $"{userName} 掷出了 {rollResult}");
        }
        
        // 如果掷出100，升级为大魔王
        if (rollResult == 100)
        {
            await UpgradeToDemonLord(userId, userName);
        }
    }
    
    private async Task UpgradeToDemonLord(string newDemonLordId, string newDemonLordName)
    {
        try
        {
            // 如果已有大魔王，先处理原大魔王
            if (CurrentDemonLord != null)
            {
                var oldDemonLordName = _userManager.FindUserById(CurrentDemonLord)?.Name;
                _logger.LogInformation($"原大魔王名称: {oldDemonLordName}");
                
                if (oldDemonLordName == "大魔王")
                {
                    // 将原大魔王改名
                    var random = new Random();
                    var newName = $"前大魔王_{random.Next(1000, 9999)}";
                    _logger.LogInformation($"将原大魔王改名为: {newName}");
                    
                    _userManager.RenameUserById(CurrentDemonLord, newName);
                    
                    // 验证改名是否成功
                    var renamedUser = _userManager.FindUserById(CurrentDemonLord);
                    _logger.LogInformation($"改名后用户信息: {renamedUser?.Name}");
                    
                    // 通知原大魔王被改名
                    if (newDemonLordName != "勇者")
                    {
                        await Clients.User(CurrentDemonLord).SendAsync("NewChat", "系统", $"您已被新大魔王夺权，新名字：{newName}");
                        await Clients.All.SendAsync("NewChat", "系统", $"🔥 {newDemonLordName} 成功夺权！原大魔王被降级为 {newName}");
                    }
                    
                    // 通知所有客户端更新原大魔王的用户名
                    _logger.LogInformation($"发送原大魔王用户名更新通知: {CurrentDemonLord} -> {newName}");
                    await OnlineUserRename(CurrentDemonLord);
                }
            }
            
            // 设置新大魔王
            CurrentDemonLord = newDemonLordId;
            _logger.LogInformation($"设置新大魔王: {newDemonLordId} -> 大魔王");
            _userManager.RenameUserById(newDemonLordId, "大魔王");
            
            // 验证新大魔王设置是否成功
            var newDemonLord = _userManager.FindUserById(newDemonLordId);
            _logger.LogInformation($"新大魔王信息: {newDemonLord?.Name}");
            
            // 通知所有用户新大魔王诞生（隐藏勇者的作弊行为）
            if (newDemonLordName != "勇者")
            {
                await Clients.All.SendAsync("NewChat", "系统", $"👑 恭喜 {newDemonLordName} 掷出100！成功升级为大魔王！");
            }
            
            // 通知所有客户端更新新大魔王的用户名
            _logger.LogInformation($"发送新大魔王用户名更新通知: {newDemonLordId} -> 大魔王");
            await OnlineUserRename(newDemonLordId);
            
            // 记录日志
            _logger.LogInformation($"用户 {newDemonLordName} (ID: {newDemonLordId}) 通过 roll 100 升级为大魔王");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"升级用户 {newDemonLordName} 为大魔王时发生错误");
            await Clients.Caller.SendAsync("NewChat", "系统", $"升级大魔王失败，请重试");
        }
    }
    
    public async Task SetLoopMode(bool content)
    {
        await _musicBroadcaster.SetLoopMode(content);
    }

    public async Task RequestLoopModeStatus()
    {
        await Clients.Caller.SendAsync("ReceiveLoopModeStatus", _musicBroadcaster._loopMode);
    }

    public async Task DeleteSong(string actionId)
    {
        var musicName = _musicBroadcaster.GetMusicName(actionId);
        if (!string.IsNullOrEmpty(musicName))
        {
            _musicBroadcaster.DeleteSong(actionId);
            await Clients.All.SendAsync("MusicDeleted", 
                actionId, 
                _userManager.FindUserById(Context.User!.Identity!.Name!)!.Name,
                musicName);
        }
    }
}