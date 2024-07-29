import { Flex, Input, Button, useToast, Select, Text } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { Connection } from '../api/musichub';
import { toastEnqueueOk, toastError } from '../utils/toast';

export const MusicSelectorByName = (props: { apis: string[]; conn: Connection }) => {
  const [name, setName] = useState('');
  const [apiName, setApiName] = useState('');
  const t = useToast();
  useEffect(() => {
    setApiName(props.apis[0]);
  }, [props.apis]);
  return (
    <>
      <Flex flexDirection={'row'} alignItems={'center'} mb={4}>
        <Text>选择平台</Text>
        <Select
          ml={2}
          flex={1}
          onChange={(e) => {
            setApiName(e.target.value);
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

      <Flex flexDirection={'row'}>
        <Input
          flex={1}
          type={'text'}
          value={name}
          placeholder={'输入音乐 名称'}
          onChange={(e) => {
            setName(e.target.value);
          }}
        />
        <Button
          ml={2}
          onClick={() => {
            if (name.length > 0)
              props.conn
                .enqueueMusicByName(name, apiName)
                .then(() => {
                  toastEnqueueOk(t);
                  setName('');
                })
                .catch((e) => {
                  toastError(t, `音乐 {名称: ${name}} 加入队列失败`);
                  console.error(e);
                });
          }}
        >
          点歌
        </Button>
      </Flex>
    </>
  );
};
