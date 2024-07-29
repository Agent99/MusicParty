import { Flex, Input, Button, useToast, Select, Text, Accordion} from '@chakra-ui/react';
import { useState, useEffect} from 'react';
import { Connection } from '../api/musichub';
import { SongList } from "./songlist";
import * as api from "../api/api";

export const SongListByName = (props: { apis: string[]; conn: Connection; enqueue: (id: string, apiName: string) => void; }) => {
  const [name, setName] = useState('');
  const [apiName, setApiName] = useState('');
  const [playlists, setPlaylists] = useState<api.Playlist[]>([]);
  const [someHook, setSomeHook] = useState(0);

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
          onClick={async () => {
            if (name.length > 0){
              const searchPlaylists = await api.getMusicsByName(name, 1, apiName);
              setPlaylists(searchPlaylists);
            }
          }}
        >
          查询
        </Button>
      </Flex>
      <Accordion allowMultiple key={someHook}>
        {playlists.map((p) => (
          <SongList
            key={p.id}
            id={p.id}
            name={p.name}
            apiName={apiName}
            enqueue={props.enqueue}
          />
        ))}
      </Accordion>
    </>
  );
};
