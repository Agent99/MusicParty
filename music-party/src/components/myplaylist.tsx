import {
  Text,
  Skeleton,
  Stack,
  Accordion,
  useToast,
  Flex,
  Select,
  Box,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import * as api from "../api/api";
import { toastError } from "../utils/toast";
import { Playlist } from "./playlist";

export const MyPlaylist = (props: {
  apis: string[];
  enqueue: (id: string, apiName: string) => void;
}) => {
  const [canshow, setCanshow] = useState(false);
  const [playlists, setPlaylists] = useState<api.Playlist[]>([]);
  const [needBind, setNeedBind] = useState(false);
  const [apiName, setApiName] = useState("");
  const [playlistCache, setPlaylistCache] = useState<
    Map<string, api.Playlist[]>
  >(new Map<string, api.Playlist[]>());
  const [someHook, setSomeHook] = useState(0);
  const [apis, setApis] = useState<string[]>([]);
  const t = useToast();

  useEffect(() => {
    api.getBindInfo().then((info: { key: string; value: string }[]) => {
      setApis(info.map((x) => x.key));
      if (info.length > 0) {
        const defaultApi = info[0].key;
        setApiName(defaultApi);
      } else {
        setNeedBind(true);
        setCanshow(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!apiName) return;
    if (playlistCache.has(apiName)) {
      setPlaylists(playlistCache.get(apiName)!);
      setSomeHook((n) => n + 1);
    } else {
      api
        .getMyPlaylist(apiName)
        .then((resp) => {
          setPlaylists(resp);
          setSomeHook((n) => n + 1);
          setCanshow(true);
          setPlaylistCache((c) => c.set(apiName, resp));
        })
        .catch((err) => {
          toastError(t, err);
        });
    }
  }, [apiName]);

  return (
    <Stack spacing={4}>
      {canshow ? (
        needBind ? (
          <Box 
            textAlign="center" 
            py={12}
            bg="orange.50"
            borderRadius="md"
            border="2px dashed"
            borderColor="orange.300"
          >
            <Text fontSize="6xl" mb={4}>🔗</Text>
            <Text fontSize="lg" color="orange.700" mb={2} fontWeight="bold">
              需要绑定音乐平台
            </Text>
            <Text fontSize="sm" color="orange.600">
              请先绑定你的音乐平台账户，然后刷新页面查看歌单
            </Text>
          </Box>
        ) : (
          <>
            {/* 平台选择区域 */}
            <Box p={4} bg="gray.50" borderRadius="md" border="1px solid" borderColor="gray.200">
              <Flex flexDirection={"row"} alignItems={"center"}>
                <Text fontWeight="bold" minW="80px">选择平台</Text>
                <Select
                  ml={2}
                  flex={1}
                  onChange={(e) => {
                    setApiName(e.target.value);
                  }}
                  defaultValue={apiName}
                  bg="white"
                >
                  {apis.map((a) => {
                    return <option key={a}>{a}</option>;
                  })}
                </Select>
              </Flex>
            </Box>

            {/* 歌单统计信息 */}
            {playlists.length > 0 && (
              <Box 
                p={3} 
                bg="green.50" 
                borderRadius="md" 
                border="1px solid" 
                borderColor="green.200"
              >
                <Text fontSize="sm" color="green.700" textAlign="center">
                  📋 共有 <Text as="span" fontWeight="bold">{playlists.length}</Text> 个歌单可供选择
                </Text>
              </Box>
            )}

            {/* 歌单列表 - 添加固定高度和滚动条 */}
            <Box 
              maxH="500px" 
              overflowY="auto" 
              border="1px solid" 
              borderColor="gray.200" 
              borderRadius="md"
              bg="white"
              css={{
                '&::-webkit-scrollbar': {
                  width: '6px',
                },
                '&::-webkit-scrollbar-track': {
                  background: '#f1f1f1',
                  borderRadius: '10px',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: 'linear-gradient(45deg, #9f7aea, #ed64a6)',
                  borderRadius: '10px',
                },
                '&::-webkit-scrollbar-thumb:hover': {
                  background: 'linear-gradient(45deg, #805ad5, #d53f8c)',
                },
              }}
            >
              {playlists.length > 0 ? (
                <Accordion allowMultiple key={someHook}>
                  {playlists.map((p, index) => (
                    <Box
                      key={p.id}
                      className="queue-item"
                      _hover={{ bg: 'green.50' }}
                      transition="all 0.2s"
                    >
                      <Playlist
                        id={p.id}
                        name={p.name}
                        apiName={apiName}
                        enqueue={props.enqueue}
                      />
                    </Box>
                  ))}
                </Accordion>
              ) : (
                <Box 
                  textAlign="center" 
                  py={12}
                  bg="gray.50"
                  borderRadius="md"
                  border="2px dashed"
                  borderColor="gray.300"
                  m={4}
                >
                  <Text fontSize="6xl" mb={4}>📋</Text>
                  <Text fontSize="lg" color="gray.600" mb={2}>
                    暂无歌单
                  </Text>
                  <Text fontSize="sm" color="gray.500">
                    请在音乐平台创建歌单后刷新页面
                  </Text>
                </Box>
              )}
            </Box>
          </>
        )
      ) : (
        <Box p={4}>
          <Text fontSize="lg" color="purple.600" mb={4} textAlign="center">
            🎵 正在加载歌单...
          </Text>
          <Stack spacing={3}>
            <Skeleton height="60px" borderRadius="md" />
            <Skeleton height="60px" borderRadius="md" />
            <Skeleton height="60px" borderRadius="md" />
            <Skeleton height="60px" borderRadius="md" />
            <Skeleton height="60px" borderRadius="md" />
          </Stack>
        </Box>
      )}
    </Stack>
  );
};
