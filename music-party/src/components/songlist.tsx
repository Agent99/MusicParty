import {
  Text,
  AccordionItem,
  List,
  ListItem,
  Flex,
  Button,
  Divider,
  Stack,
} from '@chakra-ui/react';
import {  useState } from 'react';

export const SongList = (props: {
  id: string;
  name: string;
  apiName: string;
  enqueue: (id: string, apiName: string) => void;
}) => {
  const [page, setPage] = useState(1);

  return (
    <AccordionItem>
      <Stack>
        <List spacing={2}>
          <ListItem key={props.id}>
              <Flex>
                <Text flex={1}>{`${props.name}`}</Text>
                <Button
                  onClick={() => {
                    props.enqueue(props.id, props.apiName);
                  }}
                >
                  点歌
                </Button>
              </Flex>
          </ListItem>
          </List>
        <Divider />
      </Stack>
    </AccordionItem>
  );
};
