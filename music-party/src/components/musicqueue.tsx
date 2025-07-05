import { TriangleUpIcon, DeleteIcon  } from '@chakra-ui/icons';
import {
  Text,
  Card,
  CardHeader,
  Heading,
  CardBody,
  OrderedList,
  ListItem,
  Box,
  Highlight,
  Flex,
  Tooltip,
  IconButton,
  HStack,
  Switch,
  VStack,
  Badge
} from '@chakra-ui/react';
import { MusicOrderAction } from '../api/musichub';

export const MusicQueue = (props: {
  queue: MusicOrderAction[];
  top: (actionId: string) => void;
  delete: (actionId: string) => void;
  loopMode: boolean;
  toggleLoopMode: (checked: boolean) => void;
}) => {
  return (
    <Box h="full" display="flex" flexDirection="column">
      {/* 队列标题和控制 */}
      <Flex justifyContent="space-between" alignItems="center" mb={4} flexShrink={0}>
        <Heading size={'lg'} color="purple.700">播放队列</Heading>
        <HStack spacing={2}>
          <Text fontSize="sm" color="gray.500">循环模式</Text>
          <Switch 
            colorScheme="purple"
            size="md"
            isChecked={props.loopMode}
            onChange={(e: any) => props.toggleLoopMode(e.target.checked)}
          />
        </HStack>
      </Flex>

      {/* 队列内容区域 */}
      <Box 
        flex="1"
        overflowY="auto" 
        pr={2}
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
        <VStack spacing={3} align="stretch">
          {props.queue.length > 0 ? (
            props.queue.map((v, index) => (
              <Box
                key={v.actionId} 
                p={4}
                bg={index % 2 === 0 ? 'gray.50' : 'white'}
                borderRadius="lg"
                border="1px solid"
                borderColor={index === 0 ? 'purple.300' : 'gray.200'}
                _hover={{ 
                  bg: 'purple.50', 
                  borderColor: 'purple.200',
                  transform: 'translateY(-1px)',
                  shadow: 'md'
                }}
                transition="all 0.2s"
                className="queue-item"
                position="relative"
              >
                {/* 序号标识 */}
                <Badge
                  position="absolute"
                  top={2}
                  left={2}
                  colorScheme={index === 0 ? 'purple' : 'gray'}
                  borderRadius="full"
                  fontSize="xs"
                  px={2}
                  py={1}
                >
                  #{index + 1}
                </Badge>
                
                {/* 下一首标识 */}
                {index === 0 && (
                  <Badge
                    position="absolute"
                    top={2}
                    right={2}
                    colorScheme="green"
                    borderRadius="full"
                    fontSize="xs"
                    px={2}
                    py={1}
                  >
                    🎵 下一首
                  </Badge>
                )}

                <Flex pt={6}>
                  <VStack align="start" flex={1} spacing={1}>
                    <Text fontWeight="bold" color="gray.800" fontSize="md">
                      {v.music.name}
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      {v.music.artists}
                    </Text>
                    <Text fontSize="xs" color="gray.500" fontStyle="italic">
                      由 {v.enqueuerName} 点歌
                    </Text>
                  </VStack>
                  
                  <VStack spacing={2}>
                    {props.queue.findIndex((x) => x.actionId === v.actionId) !== 0 && (
                      <Tooltip hasArrow label={'将此歌曲置于队列顶端'}>
                        <IconButton
                          onClick={() => props.top(v.actionId)}
                          aria-label={'置顶'}
                          icon={<TriangleUpIcon />}
                          size="sm"
                          variant="outline"
                          colorScheme="blue"
                          _hover={{
                            bg: 'blue.50',
                            borderColor: 'blue.300',
                            transform: 'translateY(-1px)',
                          }}
                          transition="all 0.2s"
                        />
                      </Tooltip>
                    )}
                    <Tooltip hasArrow label={'删除此歌曲'}>
                      <IconButton
                        icon={<DeleteIcon />}
                        aria-label="删除"
                        onClick={() => props.delete(v.actionId)}
                        size="sm"
                        variant="outline"
                        colorScheme="red"
                        _hover={{
                          bg: 'red.50',
                          borderColor: 'red.300',
                          transform: 'translateY(-1px)',
                        }}
                        transition="all 0.2s"
                      />
                    </Tooltip>
                  </VStack>
                </Flex>
              </Box>
            ))
          ) : (
            <Box 
              textAlign="center" 
              py={12}
              bg="gray.50"
              borderRadius="lg"
              border="2px dashed"
              borderColor="gray.300"
            >
              <Text fontSize="6xl" mb={4}>🎵</Text>
              <Text fontSize="lg" color="gray.600" fontWeight="bold" mb={2}>
                播放队列为空
              </Text>
              <Text fontSize="sm" color="gray.500">
                <Highlight
                  query={'点歌'}
                  styles={{ px: '2', py: '1', rounded: 'full', bg: 'teal.100' }}
                >
                  快去点歌吧，让音乐填满这里~
                </Highlight>
              </Text>
            </Box>
          )}
        </VStack>
      </Box>
      
      {/* 队列统计信息 */}
      {props.queue.length > 0 && (
        <Box 
          mt={4} 
          p={3} 
          bg="purple.50" 
          borderRadius="md" 
          border="1px solid" 
          borderColor="purple.200"
          flexShrink={0}
        >
          <Text fontSize="sm" color="purple.700" textAlign="center">
            📊 队列中共有 <Text as="span" fontWeight="bold">{props.queue.length}</Text> 首歌曲
            {props.loopMode && (
              <Text as="span" ml={2}>
                🔄 循环播放中
              </Text>
            )}
          </Text>
        </Box>
      )}
    </Box>
  );
};
