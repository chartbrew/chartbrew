import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Container, Input, Loading, Modal, Row, Spacer, Table, Text,
} from "@nextui-org/react";
import { formatRelative } from "date-fns";
import { Delete, Plus, TickSquare } from "react-iconly";
import { FaClipboard } from "react-icons/fa";

import { getApiKeys, createApiKey, deleteApiKey } from "../../actions/team";

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

  useEffect(() => {
    _fetchApiKeys();
  }, []);

  const _fetchApiKeys = () => {
    setLoading(true);
    getApiKeys(teamId)
      .then((keys) => {
        setApiKeys(keys);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const _onCreateRequested = () => {
    setCreateMode(true);
  };

  const _onCreateKey = () => {
    setCreateLoading(true);
    createApiKey(teamId, newKey)
      .then((createdKey) => {
        setCreateLoading(false);
        setCreateMode(false);
        setNewKey("");
        _fetchApiKeys();

        setTimeout(() => {
          setCreatedKey(createdKey);
        }, 500);
      })
      .catch(() => setCreateLoading(false));
  };

  const _onRemoveConfirmation = (key) => {
    setConfirmDelete(key.id);
  };

  const _onRemoveKey = () => {
    setCreateLoading(true);
    deleteApiKey(teamId, confirmDelete)
      .then(() => {
        setConfirmDelete(false);
        setCreateLoading(false);
        _fetchApiKeys();
      })
      .catch(() => setCreateLoading(false));
  };

  const _onCopyToken = () => {
    setTokenCopied(true);
    navigator.clipboard.writeText(createdKey.token); // eslint-disable-line
  };

  return (
    <Container>
      <Row>
        <Text h3>Team settings</Text>
      </Row>
      <Spacer y={0.5} />
      {loading && (
        <Row justify="center">
          <Loading type="spinner">Loading keys...</Loading>
        </Row>
      )}
      <Row>
        <Button
          onClick={_onCreateRequested}
          icon={<Plus />}
          auto
        >
          Create a new API Key
        </Button>
      </Row>
      <Spacer y={0.5} />

      <Table bordered shadow={false}>
        <Table.Header>
          <Table.Column key="token">API Tokens list</Table.Column>
          <Table.Column key="created" hideHeader align="flex-end">Date created</Table.Column>
          <Table.Column key="actions" hideHeader align="flex-end">Actions</Table.Column>
        </Table.Header>

        <Table.Body>
          {apiKeys.length === 0 && (
            <Table.Row>
              <Table.Cell key="token">
                <i>{"You don't have any API Keys yet"}</i>
              </Table.Cell>
              <Table.Cell key="created" />
              <Table.Cell key="actions" />
            </Table.Row>
          )}
          {apiKeys.map((key) => (
            <Table.Row key={key.id}>
              <Table.Cell key="token">
                {key.name}
              </Table.Cell>
              <Table.Cell key="created">
                {formatRelative(new Date(key.createdAt), new Date())}
              </Table.Cell>
              <Table.Cell key="actions">
                <Button
                  icon={<Delete />}
                  light
                  color="error"
                  onClick={() => _onRemoveConfirmation(key)}
                  css={{ minWidth: "fit-content" }}
                />
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>

      <Modal open={!!createdKey.id} onClose={() => setCreatedKey({})} width="500px">
        <Modal.Header>
          <Text h4>Your new API Key</Text>
        </Modal.Header>
        <Modal.Body>
          <Container>
            <Row>
              <Text color="success">{"Congrats! your new API key has been created."}</Text>
            </Row>
            <Spacer y={0.5} />
            <Row>
              <Text>{"This is the only time we show you the code, so please copy it before closing this window."}</Text>
            </Row>
            <Spacer y={2} />
            <Row>
              <Input
                label="Your new API Key"
                value={createdKey.token}
                bordered
                fullWidth
              />
            </Row>
            <Spacer y={0.5} />
            <Row>
              <Button
                bordered
                icon={tokenCopied ? <TickSquare /> : <FaClipboard />}
                color={tokenCopied ? "success" : "primary"}
                onClick={_onCopyToken}
                auto
              >
                {tokenCopied ? "Copied!" : "Copy to clipboard"}
              </Button>
            </Row>
          </Container>
        </Modal.Body>
        <Modal.Footer>
          <Button
            color="warning"
            flat
            onClick={() => setCreatedKey({})}
            auto
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal open={createMode} onClose={() => setCreateMode(false)} width="500px">
        <Modal.Header>
          <Text h4>Create a new API Key</Text>
        </Modal.Header>
        <Modal.Body>
          <Container>
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
                bordered
                fullWidth
              />
            </Row>
          </Container>
        </Modal.Body>
        <Modal.Footer>
          <Button
            color="warning"
            auto
            flat
            onClick={() => setCreateMode(false)}
          >
            Close
          </Button>
          <Button
            onClick={_onCreateKey}
            disabled={!newKey || createLoading}
            auto
          >
            Create the key
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal blur open={!!confirmDelete} onClose={() => setConfirmDelete(false)}>
        <Modal.Header>
          <Text h4>Are you sure you want to delete the key?</Text>
        </Modal.Header>
        <Modal.Body>
          <Text>{"This key will lose access to Chartbrew. This action cannot be undone."}</Text>
        </Modal.Body>
        <Modal.Footer>
          <Button
            color="warning"
            auto
            flat
            onClick={() => setConfirmDelete(false)}
          >
            Go back
          </Button>
          <Button
            color="error"
            onClick={_onRemoveKey}
            disabled={createLoading}
            auto
          >
            Remove key permanently
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

ApiKeys.propTypes = {
  teamId: PropTypes.number.isRequired,
};

export default ApiKeys;
