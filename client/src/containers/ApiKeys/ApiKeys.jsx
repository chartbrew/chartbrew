import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Button, CircularProgress, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spacer, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow,
} from "@heroui/react";
import { formatRelative } from "date-fns";
import { LuClipboard, LuClipboardCheck, LuPlus, LuTrash } from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";

import { getApiKeys, createApiKey, deleteApiKey, selectTeam } from "../../slices/team";
import Row from "../../components/Row";
import Text from "../../components/Text";
import { useParams } from "react-router";
import canAccess from "../../config/canAccess";
import { selectUser } from "../../slices/user";

function ApiKeys(props) {
  const { teamId } = props;

  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [createdKey, setCreatedKey] = useState({});
  const [tokenCopied, setTokenCopied] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dispatch = useDispatch();
  const params = useParams();

  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);

  useEffect(() => {
    _fetchApiKeys();
  }, []);

  const _fetchApiKeys = () => {
    setLoading(true);
    dispatch(getApiKeys({ team_id: params.teamId }))
      .then((keys) => {
        if (keys?.error) {
          setLoading(false);
          return;
        }
        setApiKeys(keys.payload);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const _onCreateRequested = () => {
    setCreateMode(true);
  };

  const _onCreateKey = () => {
    setCreateLoading(true);
    dispatch(createApiKey({ team_id: teamId, keyName: newKey }))
      .then((createdKey) => {
        setCreateLoading(false);
        setCreateMode(false);
        setNewKey("");
        _fetchApiKeys();

        setTimeout(() => {
          setCreatedKey(createdKey.payload);
        }, 500);
      })
      .catch(() => setCreateLoading(false));
  };

  const _onRemoveConfirmation = (key) => {
    setConfirmDelete(key.id);
  };

  const _onRemoveKey = () => {
    setCreateLoading(true);
    dispatch(deleteApiKey({ team_id: teamId, keyId: confirmDelete }))
      .then(() => {
        setConfirmDelete(false);
        setCreateLoading(false);
        _fetchApiKeys();
      })
      .catch(() => setCreateLoading(false));
  };

  const _onCopyToken = () => {
    setTokenCopied(true);
    navigator.clipboard.writeText(createdKey.token);
  };

  if (!canAccess("teamAdmin", user.id, team.TeamRoles)) {
    return (
      <div className="container mx-auto">
        <Alert
          color="default"
          title="You don't have access to this page"
          description="Please contact your team admin or change the team from the sidebar"
        />
      </div>
    )
  }

  return (
    <div>
      <Row>
        <Text size="h4">Developer settings</Text>
      </Row>
      <Spacer y={4} />
      {loading && (
        <Row justify="center">
          <CircularProgress aria-label="Loading keys">Loading keys...</CircularProgress>
        </Row>
      )}
      <Row>
        <Button
          onPress={_onCreateRequested}
          endContent={<LuPlus />}
          color="primary"
        >
          Create a new API Key
        </Button>
      </Row>
      <Spacer y={2} />

      <Table shadow={"none"} aria-label="API keys">
        <TableHeader>
          <TableColumn key="token">API Tokens list</TableColumn>
          <TableColumn key="created" hideHeader align="flex-end">Date created</TableColumn>
          <TableColumn key="actions" hideHeader align="flex-end">Actions</TableColumn>
        </TableHeader>

        <TableBody>
          {apiKeys.length === 0 && (
            <TableRow>
              <TableCell key="token">
                <i>{"You don't have any API Keys yet"}</i>
              </TableCell>
              <TableCell key="created" />
              <TableCell key="actions" />
            </TableRow>
          )}
          {apiKeys.map((key) => (
            <TableRow key={key.id}>
              <TableCell key="token">
                {key.name}
              </TableCell>
              <TableCell key="created">
                {formatRelative(new Date(key.createdAt), new Date())}
              </TableCell>
              <TableCell key="actions">
                <Button
                  isIconOnly
                  variant="light"
                  color="danger"
                  onPress={() => _onRemoveConfirmation(key)}
                >
                  <LuTrash />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Modal isOpen={!!createdKey.id} onClose={() => setCreatedKey({})} size="xl">
        <ModalContent>
          <ModalHeader>
            <Text size="h4">Your new API Key</Text>
          </ModalHeader>
          <ModalBody>
            <Row>
              <Text color="success">{"Congrats! your new API key has been created."}</Text>
            </Row>
            <Row>
              <Text>{"This is the only time we show you the code, so please copy it before closing this window."}</Text>
            </Row>
            <Spacer y={1} />
            <Row>
              <Input
                label="Your new API Key"
                value={createdKey.token}
                variant="bordered"
                fullWidth
              />
            </Row>
            <Row>
              <Button
                startContent={tokenCopied ? <LuClipboardCheck /> : <LuClipboard />}
                color={tokenCopied ? "success" : "primary"}
                variant={tokenCopied ? "flat" : "solid"}
                onPress={_onCopyToken}
              >
                {tokenCopied ? "Copied!" : "Copy to clipboard"}
              </Button>
            </Row>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onPress={() => setCreatedKey({})}
            >
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={createMode} onClose={() => setCreateMode(false)} size="xl">
        <ModalContent>
          <ModalHeader>
            <Text size="h4">Create a new API Key</Text>
          </ModalHeader>
          <ModalBody>
            <Row>
              <Text>{"The API key will give the same access to your team as your current account. Please make sure you do not misplace the key."}</Text>
            </Row>
            <Spacer y={1} />
            <Row>
              <Input
                label="Enter a name to remember it later"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="Enter a name here"
                variant="bordered"
                fullWidth
              />
            </Row>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onPress={() => setCreateMode(false)}
            >
              Close
            </Button>
            <Button
              onPress={_onCreateKey}
              isDisabled={!newKey}
              isLoading={createLoading}
              color="primary"
            >
              Create the key
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal backdrop="blur" isOpen={!!confirmDelete} onClose={() => setConfirmDelete(false)}>
        <ModalContent>
          <ModalHeader>
            <Text size="h4">Are you sure you want to delete the key?</Text>
          </ModalHeader>
          <ModalBody>
            <Text>{"This key will lose access to Chartbrew. This action cannot be undone."}</Text>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onPress={() => setConfirmDelete(false)}
            >
              Go back
            </Button>
            <Button
              color="danger"
              onPress={_onRemoveKey}
              isLoading={createLoading}
            >
              Remove key permanently
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

ApiKeys.propTypes = {
  teamId: PropTypes.number.isRequired,
};

export default ApiKeys;
