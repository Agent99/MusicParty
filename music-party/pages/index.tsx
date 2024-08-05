import Head from 'next/head';
import React, { useEffect, useRef, useState } from 'react';
import { Connection, Music, MusicOrderAction } from '../src/api/musichub';
import {
  Text,
  Button,
  Card,
  CardBody,
  CardHeader,
  Grid,
  GridItem,
  Heading,
  Input,
  ListItem,
  OrderedList,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  useToast,
  Stack,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverCloseButton,
  PopoverContent,
  PopoverFooter,
  PopoverHeader,
  PopoverTrigger,
  Portal,
  UnorderedList,
  Flex,

  Highlight,
  Box,
} from '@chakra-ui/react';
import { MusicPlayer } from '../src/components/musicplayer';
import { getMusicApis, getProfile } from '../src/api/api';
import { NeteaseBinder } from '../src/components/neteasebinder';
import { MyPlaylist } from '../src/components/myplaylist';
import { toastEnqueueOk, toastError, toastInfo } from '../src/utils/toast';
import { MusicSelector } from '../src/components/musicselector';
import { MusicSelectorByName } from '../src/components/musicselectorByName';
import { QQMusicBinder } from '../src/components/qqmusicbinder';
import { MusicQueue } from '../src/components/musicqueue';
import { BilibiliBinder } from '../src/components/bilibilibinder';
import { SongListByName } from '../src/components/songListByName';

export default function Home() {
  const [src, setSrc] = useState('');
  const [playtime, setPlaytime] = useState(0);
  const [nowPlaying, setNowPlaying] = useState<{
    music: Music;
    enqueuer: string;
  }>();
  const [queue, setQueue] = useState<MusicOrderAction[]>([]);
  const [userName, setUserName] = useState('');
  const [newName, setNewName] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<
    { id: string; name: string }[]
  >([]);
  const [inited, setInited] = useState(false);
  const [chatContent, setChatContent] = useState<
    { name: string; content: string }[]
  >([]);
  const [chatToSend, setChatToSend] = useState('');
  const [apis, setApis] = useState<string[]>([]);
  const t = useToast();

  const conn = useRef<Connection>();
  const chatContentRef = useRef<HTMLUListElement>(null); // 指定类型为 HTMLUListElement

  const [colors, setColors] = useState<{ [key: number]: string }>({});

  const getRandomColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  };

  // 使用一个对象来存储颜色，key为随机生成的值
  const getColorForMessage = (key: number) => {
    if (!colors[key]) {
      const newColor = getRandomColor();
      setColors((prevColors) => ({ ...prevColors, [key]: newColor }));
      return newColor;
    }
    return colors[key];
  };

  useEffect(() => {
    if (!conn.current) {
      conn.current = new Connection(
        `${window.location.origin}/music`,
        async (music: Music, enqueuerName: string, playedTime: number) => {
          console.log(music);
          setSrc(music.url);
          setNowPlaying({ music, enqueuer: enqueuerName });
          setPlaytime(playedTime);
        },
        async (actionId: string, music: Music, enqueuerName: string) => {
          setQueue((q) => q.concat({ actionId, music, enqueuerName }));
        },
        async () => {
          setQueue((q) => q.slice(1));
        },
        async (actionId: string, operatorName: string) => {
          setQueue((q) => {
            const target = q.find((x) => x.actionId === actionId)!;
            toastInfo(
              t,
              `歌曲 "${target.music.name}-${target.music.artists}" 被 ${operatorName} 置顶了`
            );
            return [target].concat(q.filter((x) => x.actionId !== actionId));
          });
        },
        async (actionId: string, operatorName: string) => {
          setQueue((q) => {
            // 查找目标歌曲
            const target = q.find((x) => x.actionId === actionId)!;
        
            // 显示删除通知
            toastInfo(
              t,
              `歌曲 "${target.music.name}-${target.music.artists}" 被 ${operatorName} 删除了`
            );
        
            // 返回一个新的队列，过滤掉被删除的歌曲
            return q.filter((x) => x.actionId !== actionId);
          });
        },
        async (operatorName: string, _) => {
          toastInfo(t, `${operatorName} 切到了下一首歌`);
        },
        async (id: string, name: string) => {
          setOnlineUsers((u) => u.concat({ id, name }));
        },
        async (id: string) => {
          setOnlineUsers((u) => u.filter((x) => x.id !== id));
        },
        async (id: string, newName: string) => {
          setOnlineUsers((u) =>
            u.map((x) => (x.id === id ? { id, name: newName } : x))
          );
        },
        async (name: string, content: string) => {
          setChatContent((c) => c.concat({ name, content }));
        },
        async (content: string) => {
          // todo
          console.log(content);
        },
        async (msg: string) => {
          console.error(msg);
          toastError(t, msg);
        }
      );
      conn.current
        .start()
        .then(async () => {
          try {
            const queue = await conn.current!.getMusicQueue();
            setQueue(queue);
            const users = await conn.current!.getOnlineUsers();
            setOnlineUsers(users);
          } catch (err: any) {
            toastError(t, err);
          }
        })
        .catch((e) => {
          console.error(e);
          toastError(t, '请刷新页面重试');
        });

      getProfile()
        .then((u) => {
          setUserName(u.name);
        })
        .catch((e) => {
          console.error(e);
          toastError(t, '请刷新页面重试');
        });

      getMusicApis().then((as) => setApis(as));

      setInited(true);


      

    }
  }, []);

  useEffect(() => {
    // 每次聊天内容更新后，滚动到最下方
    if (chatContentRef.current) {
      chatContentRef.current.scrollTop = chatContentRef.current.scrollHeight;
    }
  }, [chatContent]); // 依赖于 chatContent，当其变化时执行


  return (
    <Grid templateAreas={`"nav main"`} gridTemplateColumns={'2fr 5fr'} gap='1'>
      <Head>
        <title>🎵 山东油盐社广播音乐台FM 🎵</title>
        <meta name='description' content='享受音趴，凑合用吧！' />
        <link rel='icon' href='/favicon.ico' />
        <meta name='referrer' content='never' />
      </Head>
      <GridItem area={'nav'}>
        <Stack m={4} spacing={4}>
          <Card>
            <CardHeader>
              <Heading>{`欢迎, ${userName}!`}</Heading>
            </CardHeader>
            <CardBody>
              <Stack>
                <Popover>
                  {({ onClose }) => (
                    <>
                      <PopoverTrigger>
                        <Button>修改名字</Button>
                      </PopoverTrigger>
                      <Portal>
                        <PopoverContent>
                          <PopoverArrow />
                          <PopoverHeader>修改名字</PopoverHeader>
                          <PopoverCloseButton />
                          <PopoverBody>
                            <Input
                              value={newName}
                              placeholder={'输入新名字'}
                              onChange={(e) => setNewName(e.target.value)}
                            ></Input>
                          </PopoverBody>
                          <PopoverFooter>
                            <Button
                              colorScheme='blue'
                              onClick={async () => {
                                if (newName === '') return;
                                await conn.current!.rename(newName);
                                const user = await getProfile();
                                setUserName(user.name);
                                onClose();
                                setNewName('');
                              }}
                            >
                              确认
                            </Button>
                          </PopoverFooter>
                        </PopoverContent>
                      </Portal>
                    </>
                  )}
                </Popover>
                {apis.includes('NeteaseCloudMusic') && <NeteaseBinder />}
                {apis.includes('QQMusic') && <QQMusicBinder />}
                {apis.includes('Bilibili') && <BilibiliBinder />}
              </Stack>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <Heading>在线</Heading>
            </CardHeader>
            <CardBody>
              <UnorderedList>
                {onlineUsers.map((u) => {
                  return <ListItem key={u.id}>{u.name}</ListItem>;
                })}
              </UnorderedList>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <Heading>聊天</Heading>
            </CardHeader>
            <CardBody>
              <Flex>
                <Input
                  flex={1}
                  value={chatToSend}
                  onChange={(e) => setChatToSend(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      if (chatToSend === '') return;
                      await conn.current?.chatSay(chatToSend);
                      setChatToSend('');
                    }
                  }}
                />
                <Button
                  ml={2}
                  onClick={async () => {
                    if (chatToSend === '') return;
                    await conn.current?.chatSay(chatToSend);
                    setChatToSend('');
                  }}
                >
                  发送
                </Button>
              </Flex>
              <UnorderedList ref={chatContentRef}  style={{ maxHeight: '300px', overflowY: 'auto', width: '240px'  }} >
                {chatContent.map((s, index) => (
                  <ListItem key={index} style={{ color: getColorForMessage(index) }}>
                    {`${s.name}: ${s.content}`}
                  </ListItem>
                ))}
              </UnorderedList>
            </CardBody>
          </Card>
        </Stack>
      </GridItem>

      <GridItem area={'main'}>
        <Tabs>
          <TabList>
            <Tab>播放列表</Tab>
            <Tab>从音乐ID点歌</Tab>
            <Tab>从音乐名称点歌</Tab>
            <Tab>从音乐名称点歌New</Tab>
            <Tab>从歌单点歌</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <Flex flexDirection={'row'} mb={4} alignItems={'flex-end'}>
                {nowPlaying ? (
                  <>
                    <Heading>
                      {`正在播放:\n ${nowPlaying?.music.name} - ${nowPlaying?.music.artists}`}
                    </Heading>
                    <Text size={'md'} fontStyle={'italic'} ml={2}>
                      {`由 ${nowPlaying?.enqueuer} 点歌`}
                    </Text>
                  </>
                ) : (
                  <Heading>暂无歌曲正在播放</Heading>
                )}
              </Flex>

              <MusicPlayer
                src={src}
                playtime={playtime}
                nextClick={() => {
                  
                  conn.current?.nextSong();
                }}
                reset={() => {
                  console.log('reset');
                  conn.current!.requestSetNowPlaying();
                  conn.current!.getMusicQueue().then((q) => {
                    setQueue(q);
                  });
                }}
              />

              <MusicQueue
                queue={queue}
                top={(actionId) => {
                  conn.current!.topSong(actionId);
                }}
                delete={(actionId) => {
                  conn.current!.delSong(actionId);
                }

                }
              />
            </TabPanel>
            <TabPanel>
              <MusicSelector apis={apis} conn={conn.current!} />
            </TabPanel>
            <TabPanel>
              <MusicSelectorByName apis={apis} conn={conn.current!} />
            </TabPanel>
            <TabPanel>
              <SongListByName 
              apis={apis} 
              conn={conn.current!}
              enqueue={(id, apiName) => {
                conn
                  .current!.enqueueMusic(id, apiName)
                  .then(() => {
                    toastEnqueueOk(t);
                  })
                  .catch(() => {
                    toastError(t, `音乐 {id: ${id}} 加入队列失败`);
                  });
              }}  />
            </TabPanel>
            <TabPanel>
              {!inited ? (
                <Text>初始化...</Text>
              ) : (
                <MyPlaylist
                  apis={apis}
                  enqueue={(id, apiName) => {
                    conn
                      .current!.enqueueMusic(id, apiName)
                      .then(() => {
                        toastEnqueueOk(t);
                      })
                      .catch(() => {
                        toastError(t, `音乐 {id: ${id}} 加入队列失败`);
                      });
                  }}
                />
              )}
            </TabPanel>
          </TabPanels>
        </Tabs>
      </GridItem>
    </Grid>
  );
}
