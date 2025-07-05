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
  Container,
  VStack,
  HStack,
  Badge,
  useColorModeValue,
  Divider,
  Avatar,
  AvatarGroup,
} from '@chakra-ui/react';
// 使用 Chakra UI 内置图标
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
  const [loopMode, setLoopMode] = useState(true);
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

  // 颜色主题
  const bgGradient = useColorModeValue(
    'linear(to-br, purple.50, pink.50, blue.50)',
    'linear(to-br, purple.900, pink.900, blue.900)'
  );
  const cardBg = useColorModeValue('white', 'gray.800');
  const cardShadow = useColorModeValue('xl', 'dark-lg');

  const currentVoice = 0;
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
          // 重新获取当前用户信息，以防用户名被更新
          getProfile()
            .then((u) => {
              setUserName(u.name);
            })
            .catch((e) => {
              console.error(e);
            });
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
        },
        (status: boolean) => {
          setLoopMode(status);
        },
        async (actionId: string, operatorName: string, musicName: string) => {
          toastInfo(t, `${operatorName} 删除了歌曲 "${musicName}"`);
          setQueue(q => q.filter(x => x.actionId !== actionId));
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
            // 请求当前循环模式状态
            await conn.current!.requestLoopModeStatus();
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

  const toggleLoopMode = (isLooping: boolean) => {
    setLoopMode(isLooping);
    conn.current!.setLoopMode(isLooping)
      .catch((error) => {
        setLoopMode(!isLooping);
        console.error('切换循环模式失败:', error);
        toastError(t, `循环模式切换失败: ${error.message}`);
      });
  };

  return (
    <Box minH="100vh" bgGradient={bgGradient}>
      <Head>
        <title>🎵 山东油盐社广播音乐台FM 🎵</title>
        <meta name='description' content='享受音趴，凑合用吧！' />
        <link rel='icon' href='/favicon.ico' />
        <meta name='referrer' content='never' />
      </Head>
      <Container maxW="container.xl" p={{ base: 2, lg: 4 }}>
        <VStack spacing={6} align="stretch">
          {/* 页面标题 */}
          <Box textAlign="center" py={{ base: 4, lg: 6 }}>
            <HStack justify="center" spacing={{ base: 2, lg: 4 }} mb={4}>
              <Text fontSize={{ base: '2xl', lg: '4xl' }}>🎵</Text>
              <Heading 
                size={{ base: 'xl', lg: '2xl' }} 
                bgGradient="linear(to-r, purple.500, pink.500, blue.500)"
                bgClip="text"
                fontWeight="extrabold"
              >
                山东油盐社广播音乐台FM
              </Heading>
              <Text fontSize={{ base: '2xl', lg: '4xl' }}>🎵</Text>
            </HStack>
            <Text fontSize={{ base: 'md', lg: 'lg' }} color="gray.600" fontStyle="italic">
              🎶 享受音趴，一起嗨起来！ 🎶
            </Text>
          </Box>

          <Grid 
            templateColumns={{ base: '1fr', lg: '350px 1fr' }} 
            templateRows={{ base: 'auto auto', lg: '1fr' }}
            gap={6}
          >
            {/* 左侧边栏 */}
            <GridItem>
              <VStack 
                spacing={{ base: 4, lg: 6 }} 
                align="stretch" 
                h={{ base: 'auto', lg: '800px' }}
              >
                {/* 用户信息卡片 */}
                <Card 
                  bg={cardBg} 
                  shadow={cardShadow} 
                  borderRadius="xl"
                  border="1px solid"
                  borderColor="purple.200"
                  _hover={{ transform: 'translateY(-2px)', shadow: '2xl' }}
                  transition="all 0.2s"
                  flex="0 0 auto"
                  h={{ base: 'auto', lg: '246px' }}
                  minH={{ base: '200px', lg: 'unset' }}
                >
                  <CardHeader pb={2}>
                    <HStack>
                      <Avatar size="sm" name={userName} bg="purple.500" />
                      <VStack align="start" spacing={0}>
                        <Heading size="md" color="purple.600">
                          欢迎回来！
                        </Heading>
                        <Text fontSize="lg" fontWeight="bold">
                          {userName}
                        </Text>
                      </VStack>
                    </HStack>
                  </CardHeader>
                  <CardBody pt={0} overflow="hidden">
                    <VStack spacing={4} align="stretch" h="full">
                      <Popover placement="right-start">
                        {({ onClose }) => (
                          <>
                            <PopoverTrigger>
                              <Button 
                                colorScheme="purple" 
                                variant="ghost"
                                size="xs"
                                fontSize="xs"
                                px={2}
                                py={1}
                                h="24px"
                                _hover={{ 
                                  bg: 'purple.100',
                                  transform: 'scale(1.05)'
                                }}
                                transition="all 0.2s"
                              >
                                ✏️ 修改昵称
                              </Button>
                            </PopoverTrigger>
                            <Portal>
                              <PopoverContent zIndex={9999} maxW="250px">
                                <PopoverArrow />
                                <PopoverHeader fontWeight="bold" fontSize="sm">修改昵称</PopoverHeader>
                                <PopoverCloseButton size="sm" />
                                <PopoverBody py={3}>
                                  <Input
                                    value={newName}
                                    placeholder="输入新昵称"
                                    onChange={(e) => setNewName(e.target.value)}
                                    focusBorderColor="purple.400"
                                    size="sm"
                                  />
                                </PopoverBody>
                                <PopoverFooter py={2}>
                                  <Button
                                    colorScheme="purple"
                                    size="sm"
                                    w="full"
                                    onClick={async () => {
                                      if (newName === '') return;
                                      await conn.current!.rename(newName);
                                      const user = await getProfile();
                                      setUserName(user.name);
                                      onClose();
                                      setNewName('');
                                    }}
                                  >
                                    确认修改
                                  </Button>
                                </PopoverFooter>
                              </PopoverContent>
                            </Portal>
                          </>
                        )}
                      </Popover>
                      
                      <Divider />
                      
                      <VStack spacing={3} align="stretch">
                        <Text fontSize="sm" fontWeight="bold" color="gray.600">
                          音乐平台绑定
                        </Text>
                        {apis.includes('NeteaseCloudMusic') && <NeteaseBinder />}
                        {apis.includes('QQMusic') && <QQMusicBinder />}
                        {apis.includes('Bilibili') && <BilibiliBinder />}
                      </VStack>
                    </VStack>
                  </CardBody>
                </Card>

                {/* 在线用户卡片 */}
                <Card 
                  bg={cardBg} 
                  shadow={cardShadow} 
                  borderRadius="xl"
                  border="1px solid"
                  borderColor="blue.200"
                  _hover={{ transform: 'translateY(-2px)', shadow: '2xl' }}
                  transition="all 0.2s"
                  flex="0 0 auto"
                  h={{ base: 'auto', lg: '253px' }}
                  minH={{ base: '180px', lg: 'unset' }}
                >
                  <CardHeader pb={2}>
                    <HStack>
                      <Text fontSize="xl">👥</Text>
                      <Heading size="md" color="blue.600">
                        在线用户
                      </Heading>
                      <Badge colorScheme="blue" borderRadius="full">
                        {onlineUsers.length}
                      </Badge>
                    </HStack>
                  </CardHeader>
                  <CardBody pt={0} overflow="hidden">
                    <VStack spacing={2} align="stretch" h="full" overflowY="auto">
                      {onlineUsers.map((u) => (
                        <HStack key={u.id} p={2} bg="blue.50" borderRadius="md">
                          <Avatar size="xs" name={u.name} bg="blue.400" />
                          <Text fontSize="sm" fontWeight="medium">
                            {u.name}
                          </Text>
                        </HStack>
                      ))}
                    </VStack>
                  </CardBody>
                </Card>

                {/* 聊天卡片 */}
                <Card 
                  bg={cardBg} 
                  shadow={cardShadow} 
                  borderRadius="xl"
                  border="1px solid"
                  borderColor="green.200"
                  _hover={{ transform: 'translateY(-2px)', shadow: '2xl' }}
                  transition="all 0.2s"
                  flex="0 0 auto"
                  h={{ base: 'auto', lg: '253px' }}
                  minH={{ base: '200px', lg: 'unset' }}
                >
                  <CardHeader pb={2}>
                    <HStack>
                      <Text fontSize="xl">💬</Text>
                      <Heading size="md" color="green.600">
                        实时聊天
                      </Heading>
                      <Badge colorScheme="red" fontSize="xs" ml="auto">
                        大魔王功能
                      </Badge>
                    </HStack>
                  </CardHeader>
                  <CardBody pt={0} overflow="hidden">
                    <VStack spacing={4} align="stretch" h="full">
                      <HStack>
                        <Input
                          flex={1}
                          value={chatToSend}
                          placeholder="说点什么... (输入 / 查看命令)"
                          onChange={(e) => setChatToSend(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === "Enter") {
                              if (chatToSend === '') return;
                              await conn.current?.chatSay(chatToSend);
                              setChatToSend('');
                            }
                          }}
                          focusBorderColor="green.400"
                          size="sm"
                        />
                        <Button
                          colorScheme="green"
                          size="sm"
                          onClick={async () => {
                            if (chatToSend === '') return;
                            await conn.current?.chatSay(chatToSend);
                            setChatToSend('');
                          }}
                        >
                          发送
                        </Button>
                      </HStack>
                      
                      {/* 命令提示 */}
                      {chatToSend.startsWith('/') && (
                        <Box 
                          bg="white" 
                          border="1px solid" 
                          borderColor="gray.200" 
                          borderRadius="md" 
                          p={2}
                          mt={2}
                        >
                          <Text fontSize="sm" fontWeight="bold" mb={2}>可用命令：</Text>
                          <VStack spacing={1} align="start">
                            <Text fontSize="xs" color="blue.600" cursor="pointer" 
                                  onClick={() => setChatToSend('/roll')}>
                              /roll - 掷骰子 (1-100)
                            </Text>
                            <Text fontSize="xs" color="red.600" cursor="pointer" 
                                  onClick={() => setChatToSend('/kick ass ')}>
                              /kick ass [用户名] - 踢人 (仅大魔王)
                            </Text>
                          </VStack>
                        </Box>
                      )}
                      
                      <Box 
                        flex="1"
                        overflowY="auto" 
                        bg="green.50" 
                        borderRadius="md" 
                        p={2}
                        ref={(el) => {
                          if (el) {
                            el.scrollTop = el.scrollHeight;
                          }
                        }}
                      >
                        <VStack spacing={1} align="stretch">
                          {chatContent.map((s, index) => (
                            <Box key={index} p={1}>
                              <Text fontSize="xs" color="gray.600">
                                <Text as="span" fontWeight="bold" color="green.600">
                                  {s.name}:
                                </Text>{' '}
                                {s.content}
                              </Text>
                            </Box>
                          ))}
                        </VStack>
                      </Box>
                    </VStack>
                  </CardBody>
                </Card>
              </VStack>
            </GridItem>

            {/* 主内容区域 */}
            <GridItem>
              <Card 
                bg={cardBg} 
                shadow={cardShadow} 
                borderRadius="xl"
                border="1px solid"
                borderColor="purple.200"
                h={{ base: 'auto', lg: '800px' }}
                minH={{ base: '600px', lg: 'unset' }}
              >
                <CardBody p={{ base: 4, lg: 6 }} h="full" overflow="hidden">
                  <Tabs variant="soft-rounded" colorScheme="purple" h="full" display="flex" flexDirection="column">
                    <TabList mb={{ base: 4, lg: 6 }} flexWrap="wrap" gap={2} flexShrink={0}>
                      <Tab _selected={{ bg: 'purple.500', color: 'white' }}>
                        <Text as="span" mr={2}>▶️</Text>
                        播放列表
                      </Tab>
                      <Tab _selected={{ bg: 'purple.500', color: 'white' }}>
                        智能搜索点歌
                      </Tab>
                      <Tab _selected={{ bg: 'purple.500', color: 'white' }}>
                        歌单点歌
                      </Tab>
                    </TabList>
                    
                    <TabPanels flex="1" overflow="hidden">
                      <TabPanel p={0} h="full" overflow="hidden">
                        <VStack spacing={{ base: 4, lg: 6 }} align="stretch" h="full">
                          {/* 正在播放区域 */}
                          <Box 
                            p={{ base: 4, lg: 6 }} 
                            bg="gradient-to-r from-purple-100 to-pink-100" 
                            borderRadius="xl"
                            border="2px solid"
                            borderColor="purple.300"
                            flexShrink={0}
                          >
                            {nowPlaying ? (
                              <VStack spacing={4} align="stretch">
                                <HStack justify="space-between" align="center">
                                  <VStack align="start" spacing={1}>
                                    <Text fontSize="sm" color="purple.600" fontWeight="bold">
                                      正在播放
                                    </Text>
                                    <Heading size="lg" color="purple.800">
                                      {nowPlaying.music.name}
                                    </Heading>
                                    <Text fontSize="md" color="purple.600">
                                      {nowPlaying.music.artists}
                                    </Text>
                                  </VStack>
                                  <VStack align="end" spacing={1}>
                                    <Badge colorScheme="purple" borderRadius="full">
                                      点歌人
                                    </Badge>
                                    <Text fontSize="sm" fontWeight="bold" color="purple.700">
                                      {nowPlaying.enqueuer}
                                    </Text>
                                  </VStack>
                                </HStack>
                              </VStack>
                            ) : (
                              <VStack spacing={4}>
                                <Text fontSize="6xl">🎵</Text>
                                <Heading size="md" color="purple.600">
                                  暂无歌曲正在播放
                                </Heading>
                                <Text color="purple.500">
                                  快去点一首歌吧！
                                </Text>
                              </VStack>
                            )}
                          </Box>

                          {/* 音乐播放器 */}
                          <Box flexShrink={0}>
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
                          </Box>

                          {/* 播放队列 */}
                          <Box flex="1" overflow="hidden">
                            <MusicQueue
                              queue={queue}
                              top={(actionId) => {
                                conn.current!.topSong(actionId);
                              }}
                              delete={(actionId) => {
                                conn.current!.deleteSong(actionId);
                              }}
                              loopMode={loopMode}
                              toggleLoopMode={toggleLoopMode}
                            />
                          </Box>
                        </VStack>
                      </TabPanel>
                      
                      <TabPanel p={0} h="full" overflow="hidden">
                        <Box h="full" overflow="auto">
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
                            }}  
                          />
                        </Box>
                      </TabPanel>
                      
                      <TabPanel p={0} h="full" overflow="hidden">
                        <Box h="full" overflow="auto">
                          {!inited ? (
                            <VStack spacing={4} py={12}>
                              <Text fontSize="6xl">🎵</Text>
                              <Text fontSize="lg" color="purple.600">
                                正在初始化...
                              </Text>
                            </VStack>
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
                        </Box>
                      </TabPanel>
                    </TabPanels>
                  </Tabs>
                </CardBody>
              </Card>
            </GridItem>
          </Grid>
        </VStack>
      </Container>
    </Box>
  );
}
