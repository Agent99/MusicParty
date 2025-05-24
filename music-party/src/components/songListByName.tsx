import React, { useState, useEffect} from 'react';
import { Flex, Input, Button, useToast, Select, Text, Accordion, HStack, IconButton} from '@chakra-ui/react';
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
    <>
      <Flex flexDirection={'row'} alignItems={'center'} mb={4}>
        <Text>选择平台</Text>
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

      <Flex flexDirection={'row'} mb={4}>
        <Input
          flex={1}
          type={'text'}
          value={name}
          placeholder={'输入音乐名称'}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setName(e.target.value);
          }}
          onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
              searchMusic(1);
            }
          }}
        />
        <Button
          ml={2}
          onClick={() => searchMusic(1)}
          isLoading={isLoading}
          loadingText="搜索中"
        >
          搜索
        </Button>
      </Flex>

      {hasSearched && (
        <>
          {musics.length > 0 ? (
            <>
              <Accordion allowMultiple>
                {musics.map((music: api.Music) => (
                  <SongList
                    key={music.id}
                    id={music.id}
                    name={`${music.name} - ${music.artists.join(', ')}`}
                    apiName={apiName}
                    enqueue={props.enqueue}
                  />
                ))}
              </Accordion>
              
              <HStack justifyContent="center" mt={4} spacing={4}>
                <IconButton
                  aria-label="上一页"
                  icon={<ChevronLeftIcon />}
                  onClick={handlePrevPage}
                  isDisabled={currentPage <= 1 || isLoading}
                  size="sm"
                />
                <Text fontSize="sm" color="gray.600">
                  第 {currentPage} 页
                </Text>
                <IconButton
                  aria-label="下一页"
                  icon={<ChevronRightIcon />}
                  onClick={handleNextPage}
                  isDisabled={isLoading || musics.length === 0}
                  size="sm"
                />
              </HStack>
            </>
          ) : (
            <Text textAlign="center" color="gray.500" mt={4}>
              没有找到相关音乐
            </Text>
          )}
        </>
      )}
    </>
  );
};
