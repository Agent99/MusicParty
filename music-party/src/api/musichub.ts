import * as sr from "@microsoft/signalr";

// 倒计时提示框函数
function showCountdownAlert(message: string, seconds: number): void {
  // 创建模态框容器
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    font-family: Arial, sans-serif;
  `;

  // 创建提示框内容
  const content = document.createElement('div');
  content.style.cssText = `
    background-color: white;
    padding: 30px;
    border-radius: 10px;
    text-align: center;
    max-width: 400px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  `;

  // 创建标题
  const title = document.createElement('h3');
  title.textContent = '⚠️ 您已被踢出房间';
  title.style.cssText = `
    margin: 0 0 15px 0;
    color: #e53e3e;
    font-size: 18px;
  `;

  // 创建消息内容
  const messageDiv = document.createElement('div');
  messageDiv.textContent = message;
  messageDiv.style.cssText = `
    margin: 0 0 20px 0;
    color: #333;
    font-size: 14px;
    line-height: 1.5;
  `;

  // 创建倒计时显示
  const countdown = document.createElement('div');
  countdown.style.cssText = `
    margin: 0 0 15px 0;
    color: #666;
    font-size: 12px;
  `;

  // 创建进度条
  const progressBar = document.createElement('div');
  progressBar.style.cssText = `
    width: 100%;
    height: 4px;
    background-color: #e2e8f0;
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 15px;
  `;

  const progressFill = document.createElement('div');
  progressFill.style.cssText = `
    height: 100%;
    background-color: #e53e3e;
    width: 100%;
    transition: width 0.1s linear;
  `;

  progressBar.appendChild(progressFill);
  content.appendChild(title);
  content.appendChild(messageDiv);
  content.appendChild(countdown);
  content.appendChild(progressBar);
  modal.appendChild(content);
  document.body.appendChild(modal);

  // 倒计时逻辑
  let timeLeft = seconds;
  const updateCountdown = () => {
    countdown.textContent = `${timeLeft} 秒后自动刷新页面...`;
    const progress = ((seconds - timeLeft) / seconds) * 100;
    progressFill.style.width = `${progress}%`;
    
    if (timeLeft <= 0) {
      document.body.removeChild(modal);
      return;
    }
    
    timeLeft--;
    setTimeout(updateCountdown, 1000);
  };

  updateCountdown();
}

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
    musicCut: (operatorName: string, music: Music) => void,
    onlineUserLogin: (id: string, name: string) => void,
    onlineUserLogout: (id: string) => void,
    onlineUserRename: (id: string, newName: string) => void,
    newChat: (name: string, content: string) => void,
    globalMessage: (content: string) => void,
    abort: (msg: string) => void,
    onLoopModeUpdate: (status: boolean) => void,
    musicDeleted: (actionId: string, operatorName: string, musicName: string) => void
  ) {
    this._conn = new sr.HubConnectionBuilder().withUrl(url).build();
    this._conn.on("SetNowPlaying", setNowPlaying);
    this._conn.on("MusicEnqueued", musicEnqueued);
    this._conn.on("MusicDequeued", musicDequeued);
    this._conn.on("MusicTopped", musicTopped);
    this._conn.on("MusicCut", musicCut);
    this._conn.on("OnlineUserLogin", onlineUserLogin);
    this._conn.on("OnlineUserLogout", onlineUserLogout);
    this._conn.on("OnlineUserRename", onlineUserRename);
    this._conn.on("NewChat", newChat);
    this._conn.on("GlobalMessage", globalMessage);
    this._conn.on("Abort", abort);
   
    this._conn.on("KickUser", (kickedUserName: string, msg: string) => {
      // 获取当前用户名，判断是否是自己被踢出
      fetch('/api/profile')
        .then(response => response.json())
        .then(data => {
          const currentUserName = data.name;
          
          if (currentUserName === kickedUserName) {
            // 创建倒计时提示框
            showCountdownAlert(`您已被踢出房间：${msg}`, 5);
            
            // 停止所有音频播放 - 使用多种方式确保停止
            // 1. 停止所有DOM中的audio元素
            const audioElements = document.querySelectorAll('audio');
            audioElements.forEach(audio => {
              audio.pause();
              audio.currentTime = 0;
              audio.src = '';
            });
            
            // 2. 停止所有通过Audio()构造函数创建的音频
            // 通过全局变量或事件来通知音乐播放器停止
            window.dispatchEvent(new CustomEvent('stopAllAudio'));
            
            // 3. 强制停止所有媒体播放
            if (navigator.mediaSession) {
              navigator.mediaSession.playbackState = 'none';
            }
            
            // 断开连接
            this._conn.stop();
            
            // 强制刷新页面以确保完全断开
            setTimeout(() => {
              window.location.reload();
            }, 6000); // 给倒计时留出时间
          }
        })
        .catch(error => {
          console.error('获取用户信息失败:', error);
        });
    });

    this._conn.on("ReceiveLoopModeStatus", onLoopModeUpdate);
    this._conn.on("MusicDeleted", musicDeleted);
    this._conn.onclose((e: any) => {
      alert(`您已断开连接，请刷新页面重连\n错误信息：${e}`);
    });
  }
  public async start(): Promise<any> {
    if (this._conn.state === sr.HubConnectionState.Disconnected) {
      await this._conn.start();
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
  public async rename(newName: string): Promise<void> {
    await this._conn.invoke("Rename", newName);
  }
  public async getOnlineUsers(): Promise<{ id: string; name: string }[]> {
    return await this._conn.invoke("GetOnlineUsers");
  }
  public async chatSay(content: string): Promise<void> {
    await this._conn.invoke("ChatSay", content);
  }
  public async setLoopMode(content: boolean): Promise<void> {
    await this._conn.invoke("SetLoopMode", content);
  }
  public async requestLoopModeStatus(): Promise<void> {
    return this._conn.invoke("RequestLoopModeStatus");
  }
  public async deleteSong(actionId: string) {
    await this._conn.invoke("DeleteSong", actionId);
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
