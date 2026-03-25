import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Button, ProgressCircle, Input, Modal, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow,
} from "@heroui/react";
import { formatRelative } from "date-fns";
import { LuClipboard, LuClipboardCheck, LuPlus, LuTrash } from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";

import { getApiKeys, createApiKey, deleteApiKey, selectTeam } from "../../slices/team";
import canAccess from "../../config/canAccess";
import { selectUser } from "../../slices/user";

function ApiKeys() {
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [createdKey, setCreatedKey] = useState({});
  const [tokenCopied, setTokenCopied] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dispatch = useDispatch();
  const initRef = useRef(false);

  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);

  useEffect(() => {
    if (team?.id && !initRef.current) {
      initRef.current = true;
      _fetchApiKeys();
    }
  }, [team]);

  const _fetchApiKeys = () => {
    setLoading(true);
    dispatch(getApiKeys({ team_id: team.id }))
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
    dispatch(createApiKey({ team_id: team.id, keyName: newKey }))
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
    dispatch(deleteApiKey({ team_id: team.id, keyId: confirmDelete }))
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
    <div className="flex flex-col bg-content1 p-4 rounded-lg border border-divider">
      <div className="text-lg font-semibold font-tw">Developer settings</div>
      <div className="text-sm text-gray-500">Manage your API keys and create new ones.</div>
      <div className="h-4" />
      {loading && (
        <div className="flex justify-center">
          <ProgressCircle aria-label="Loading keys">Loading keys...</ProgressCircle>
        </div>
      )}
      <div>
        <Button
          onPress={_onCreateRequested}
          endContent={<LuPlus />}
          color="primary"
        >
          Create a new API Key
        </Button>
      </div>
      <div className="h-2" />

      <Table className="shadow-none">
        <Table.ScrollContainer>
          <Table.Content
            aria-label="API keys"
            className="min-w-full even:[&_tbody>tr]:bg-content2/30"
          >
            <TableHeader>
              <TableColumn key="token" isRowHeader textValue="API Tokens list">
                API Tokens list
              </TableColumn>
              <TableColumn key="created" className="text-end" textValue="Date created">
                Date created
              </TableColumn>
              <TableColumn key="actions" className="w-12 text-end" textValue="Actions" />
            </TableHeader>

            <TableBody
              renderEmptyState={() => (
                <i>{"You don't have any API Keys yet"}</i>
              )}
            >
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
                  size="sm"
                >
                  <LuTrash />
                </Button>
              </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      <Modal>
        <Modal.Backdrop isOpen={!!createdKey.id} onOpenChange={(nextOpen) => { if (!nextOpen) setCreatedKey({}); }}>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-xl">
              <Modal.Header>
                <Modal.Heading className="text-lg font-semibold font-tw">
                  Your new API Key
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <div className="text-success">{"Congrats! your new API key has been created."}</div>
                <div className="text-gray-500">{"This is the only time we show you the code, so please copy it before closing this window."}</div>
                <div className="h-1" />
                <div>
                  <Input
                    label="Your new API Key"
                    value={createdKey.token}
                    variant="secondary"
                    fullWidth
                  />
                </div>
                <div>
                  <Button
                    onPress={_onCopyToken}
                    variant={tokenCopied ? "secondary" : "primary"}
                  >
                    {tokenCopied ? <LuClipboardCheck /> : <LuClipboard />}
                    {tokenCopied ? "Copied!" : "Copy to clipboard"}
                  </Button>
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  Close
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal>
        <Modal.Backdrop isOpen={createMode} onOpenChange={(nextOpen) => { if (!nextOpen) setCreateMode(false); }}>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-xl">
              <Modal.Header>
                <Modal.Heading className="text-lg font-semibold font-tw">
                  Create a new API Key
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <div className="text-gray-500">{"The API key will give the same access to your team as your current account. Please make sure you do not misplace the key."}</div>
                <div className="h-1" />
                <div>
                  <Input
                    label="Enter a name to remember it later"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="Enter a name here"
                    variant="secondary"
                    fullWidth
                  />
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  Close
                </Button>
                <Button
                  onPress={_onCreateKey}
                  isDisabled={!newKey}
                  isPending={createLoading}
                  variant="primary"
                >
                  Create the key
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal>
        <Modal.Backdrop variant="blur" isOpen={!!confirmDelete} onOpenChange={(nextOpen) => { if (!nextOpen) setConfirmDelete(false); }}>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading className="text-lg font-semibold font-tw">
                  Are you sure you want to delete the key?
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <div className="text-gray-500">{"This key will lose access to Chartbrew. This action cannot be undone."}</div>
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  Go back
                </Button>
                <Button
                  variant="danger"
                  onPress={_onRemoveKey}
                  isPending={createLoading}
                >
                  Remove key permanently
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

ApiKeys.propTypes = {
  teamId: PropTypes.number.isRequired,
};

export default ApiKeys;
