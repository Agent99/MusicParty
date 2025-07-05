import {
  Text,
  AccordionItem,
  List,
  ListItem,
  Flex,
  Button,
  Divider,
  Stack,
  Box,
  HStack,
  VStack,
  Badge,
  Tooltip
} from '@chakra-ui/react';
import {  useState } from 'react';

export const SongList = (props: {
  id: string;
  name: string;
  apiName: string;
  enqueue: (id: string, apiName: string) => void;
}) => {
  const [page, setPage] = useState(1);

  // 解析歌曲名称和艺术家（如果包含在name中）
  const parseSongInfo = (name: string) => {
    // 常见的分隔符：- / —
    const separators = [' - ', ' / ', ' — ', '—'];
    for (const sep of separators) {
      if (name.includes(sep)) {
        const parts = name.split(sep);
        return {
          title: parts[0].trim(),
          artist: parts.slice(1).join(sep).trim()
        };
      }
    }
    return { title: name, artist: '' };
  };

  const songInfo = parseSongInfo(props.name);

  // 获取平台显示名称和颜色
  const getPlatformInfo = (apiName: string) => {
    switch (apiName) {
      case 'NeteaseCloudMusic':
        return { name: '网易云', color: 'red' };
      case 'QQMusic':
        return { name: 'QQ音乐', color: 'green' };
      case 'Bilibili':
        return { name: 'B站', color: 'pink' };
      default:
        return { name: apiName, color: 'gray' };
    }
  };

  const platformInfo = getPlatformInfo(props.apiName);

  return (
    <Box
      p={4}
      _hover={{ 
        bg: 'purple.50',
        transform: 'translateY(-1px)',
        shadow: 'sm'
      }}
      transition="all 0.2s"
      borderRadius="md"
    >
      <Flex align="center" justify="space-between">
        <VStack align="start" flex={1} spacing={1} mr={4}>
          <HStack spacing={2} align="center">
            <Badge 
              colorScheme={platformInfo.color} 
              fontSize="xs" 
              px={2} 
              py={1} 
              borderRadius="full"
            >
              {platformInfo.name}
            </Badge>
            <Text fontSize="xs" color="gray.500">
              ID: {props.id}
            </Text>
          </HStack>
          
          <Text 
            fontWeight="bold" 
            color="gray.800" 
            fontSize="md"
            lineHeight="1.2"
            noOfLines={1}
          >
            {songInfo.title}
          </Text>
          
          {songInfo.artist && (
            <Text 
              fontSize="sm" 
              color="gray.600"
              lineHeight="1.2"
              noOfLines={1}
            >
              {songInfo.artist}
            </Text>
          )}
        </VStack>
        
        <Tooltip hasArrow label={`将此歌曲添加到播放队列`}>
          <Button
            onClick={() => {
              props.enqueue(props.id, props.apiName);
            }}
            colorScheme="purple"
            size="sm"
            px={6}
            _hover={{
              transform: 'translateY(-1px)',
              shadow: 'md'
            }}
            transition="all 0.2s"
          >
            🎵 点歌
          </Button>
        </Tooltip>
      </Flex>
    </Box>
  );
};
