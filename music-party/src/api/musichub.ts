import * as sr from "@microsoft/signalr";
export class Connection {
  private _conn: sr.HubConnection;
  constructor(
    url: string,
    setNowPlaying: (
      music: Music,
      enqueuerName: string,
      playedTime: number
    ) => void,
    musicEnqueued: (
      actionId: string,
      music: Music,
      enqueuerName: string
    ) => void,
    musicDequeued: () => void,
    musicTopped: (actionId: string, operatorName: string) => void,
    MusicDel: (actionId: string, operatorName: string) => void,
    musicCut: (operatorName: string, music: Music) => void,
    onlineUserLogin: (id: string, name: string) => void,
    onlineUserLogout: (id: string) => void,
    onlineUserRename: (id: string, newName: string) => void,
    newChat: (name: string, content: string) => void,
    globalMessage: (content: string) => void,
    abort: (msg: string) => void
  ) {

    this._conn = new sr.HubConnectionBuilder()
      .withUrl(url)
      .withAutomaticReconnect() // 添加自动重连
      .build();

    this._conn.on("SetNowPlaying", setNowPlaying);
    this._conn.on("MusicEnqueued", musicEnqueued);
    this._conn.on("MusicDequeued", musicDequeued);
    this._conn.on("MusicTopped", musicTopped);
    this._conn.on("MusicDel", MusicDel);
    this._conn.on("MusicCut", musicCut);
    this._conn.on("OnlineUserLogin", onlineUserLogin);
    this._conn.on("OnlineUserLogout", onlineUserLogout);
    this._conn.on("OnlineUserRename", onlineUserRename);
    this._conn.on("NewChat", newChat);
    this._conn.on("GlobalMessage", globalMessage);
    this._conn.on("Abort", abort);
    this._conn.onclose((e) => {
      alert(`您已断开连接，请刷新页面重连\n错误信息：${e}`);
    });

    // 自动重连事件处理
    this._conn.onreconnecting((e) => {
      console.log(`正在尝试重连，错误信息：${e}`);
    });

    this._conn.onreconnected((connectionId) => {
      console.log(`重连成功，连接ID：${connectionId}`);
    });
    
  }
  public async start(): Promise<any> {
    if (this._conn.state === sr.HubConnectionState.Disconnected) {
      await this._conn.start();
      console.log("music hub: " + this._conn.state);
    }
  }
  public async enqueueMusic(id: string, apiName: string): Promise<void> {   
    await this._conn.invoke("EnqueueMusic", id, apiName);
  }
  public async enqueueMusicByName(name: string, apiName: string): Promise<void> {   
    await this._conn.invoke("EnqueueMusicByName", name, apiName);
  }
  public async requestSetNowPlaying(): Promise<void> {
    await this._conn.invoke("RequestSetNowPlaying");
  }
  public async getMusicQueue(): Promise<MusicOrderAction[]> {
    return await this._conn.invoke("GetMusicQueue");
  }
  public async nextSong(): Promise<void> {
    await this._conn.invoke("NextSong");
  }
  public async topSong(actionId: string): Promise<void> {
    await this._conn.invoke("TopSong", actionId);
  }
  public async delSong(actionId: string): Promise<void> {
    await this._conn.invoke("DelSong", actionId);
  }
  public async rename(newName: string): Promise<void> {
    await this._conn.invoke("Rename", newName);
  }
  public async getOnlineUsers(): Promise<{ id: string; name: string }[]> {
    return await this._conn.invoke("GetOnlineUsers");
  }
  public async chatSay(content: string): Promise<void> {
    await this._conn.invoke("ChatSay", content);
  }
}
export interface Music {
  url: string;
  name: string;
  artists: string[];
}

export interface MusicOrderAction {
  actionId: string;
  music: Music;
  enqueuerName: string;
}
