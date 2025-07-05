import React, { useState, useEffect} from 'react';
import { Flex, Input, Button, useToast, Select, Text, HStack, IconButton, Box} from '@chakra-ui/react';
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import { Connection } from '../api/musichub';
import { SongList } from "./songlist";
import * as api from "../api/api";

export const SongListByName = (props: { apis: string[]; conn: Connection; enqueue: (id: string, apiName: string) => void; }) => {
  const [name, setName] = useState('');
  const [apiName, setApiName] = useState('');
  const [musics, setMusics] = useState<api.Music[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const t = useToast();
  
  useEffect(() => {
    setApiName(props.apis[0]);
  }, [props.apis]);

  const searchMusic = async (page: number = 1) => {
    if (name.length === 0) return;
    
    setIsLoading(true);
    try {
      const searchResults = await api.getMusicsByName(name, page, apiName);
      setMusics(searchResults);
      setCurrentPage(page);
      setHasSearched(true);
    } catch (error) {
      console.error('搜索失败:', error);
      t({
        title: '搜索失败',
        description: '请稍后重试',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      searchMusic(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    searchMusic(currentPage + 1);
  };

  return (
    <Box>
      {/* 搜索控制区域 */}
      <Box mb={4} p={4} bg="gray.50" borderRadius="md" border="1px solid" borderColor="gray.200">
        <Flex flexDirection={'row'} alignItems={'center'} mb={4}>
          <Text fontWeight="bold" minW="80px">选择平台</Text>
          <Select
            ml={2}
            flex={1}
            value={apiName}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              setApiName(e.target.value);
              // 切换平台时重置搜索结果
              setMusics([]);
              setCurrentPage(1);
              setHasSearched(false);
            }}
            bg="white"
          >
            {props.apis.map((a) => {
              return (
                <option key={a} value={a}>
                  {a}
                </option>
              );
            })}
          </Select>
        </Flex>

        <Flex flexDirection={'row'}>
          <Input
            flex={1}
            type={'text'}
            value={name}
            placeholder={'输入音乐名称进行搜索...'}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setName(e.target.value);
            }}
            onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter') {
                searchMusic(1);
              }
            }}
            bg="white"
            focusBorderColor="purple.400"
          />
          <Button
            ml={2}
            onClick={() => searchMusic(1)}
            isLoading={isLoading}
            loadingText="搜索中"
            colorScheme="purple"
            minW="80px"
          >
            🔍 搜索
          </Button>
        </Flex>
      </Box>

      {/* 搜索结果区域 */}
      {hasSearched && (
        <Box>
          {musics.length > 0 ? (
            <>
              {/* 结果统计 */}
              <Box 
                mb={4} 
                p={3} 
                bg="blue.50" 
                borderRadius="md" 
                border="1px solid" 
                borderColor="blue.200"
              >
                <Text fontSize="sm" color="blue.700" textAlign="center">
                  🎵 找到 <Text as="span" fontWeight="bold">{musics.length}</Text> 首相关歌曲 (第 {currentPage} 页)
                </Text>
              </Box>

              {/* 搜索结果列表 */}
              <Box 
                border="1px solid" 
                borderColor="gray.200" 
                borderRadius="md"
                bg="white"
                mb={4}
                overflow="hidden"
              >
                {musics.map((music: api.Music, index) => (
                  <Box
                    key={music.id}
                    borderBottom={index < musics.length - 1 ? "1px solid" : "none"}
                    borderColor="gray.100"
                  >
                    <SongList
                      id={music.id}
                      name={music.name}
                      apiName={apiName}
                      enqueue={props.enqueue}
                    />
                  </Box>
                ))}
              </Box>
              
              {/* 分页控制 */}
              <Box 
                mt={4} 
                p={3} 
                bg="gray.50" 
                borderRadius="md" 
                border="1px solid" 
                borderColor="gray.200"
              >
                <HStack justifyContent="center" spacing={4}>
                  <IconButton
                    aria-label="上一页"
                    icon={<ChevronLeftIcon />}
                    onClick={handlePrevPage}
                    isDisabled={currentPage <= 1 || isLoading}
                    size="sm"
                    colorScheme="purple"
                    variant="outline"
                  />
                  <Text fontSize="sm" color="gray.600" minW="80px" textAlign="center">
                    第 {currentPage} 页
                  </Text>
                  <IconButton
                    aria-label="下一页"
                    icon={<ChevronRightIcon />}
                    onClick={handleNextPage}
                    isDisabled={isLoading || musics.length === 0}
                    size="sm"
                    colorScheme="purple"
                    variant="outline"
                  />
                </HStack>
              </Box>
            </>
          ) : (
            <Box 
              textAlign="center" 
              py={12}
              bg="gray.50"
              borderRadius="md"
              border="2px dashed"
              borderColor="gray.300"
            >
              <Text fontSize="6xl" mb={4}>🔍</Text>
              <Text fontSize="lg" color="gray.600" mb={2}>
                没有找到相关音乐
              </Text>
              <Text fontSize="sm" color="gray.500">
                尝试使用不同的关键词或切换其他音乐平台
              </Text>
            </Box>
          )}
        </Box>
      )}

      {/* 搜索提示 */}
      {!hasSearched && (
        <Box 
          textAlign="center" 
          py={12}
          bg="gradient-to-r from-purple-50 to-pink-50"
          borderRadius="md"
          border="2px dashed"
          borderColor="purple.300"
        >
          <Text fontSize="6xl" mb={4}>🎵</Text>
          <Text fontSize="lg" color="purple.700" mb={2} fontWeight="bold">
            智能音乐搜索
          </Text>
          <Text fontSize="sm" color="purple.600">
            输入歌曲名称、歌手名字或专辑名称，快速找到你想要的音乐
          </Text>
        </Box>
      )}
    </Box>
  );
};
