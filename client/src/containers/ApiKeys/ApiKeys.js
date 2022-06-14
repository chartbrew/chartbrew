import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Form, Header, Icon, Input, Loader, Modal, Popup, Segment, Table, TransitionablePortal
} from "semantic-ui-react";
import { formatRelative } from "date-fns";

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
    <div>
      <Header attached="top" as="h3">Team settings</Header>
      <Segment attached padded style={{ paddingBottom: 40 }}>
        <Loader active={loading} />
        <Button
          content="Create a new API Key"
          onClick={_onCreateRequested}
          icon="plus"
          primary
        />
        <Table striped>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell colSpan="3">API Tokens list</Table.HeaderCell>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {apiKeys.length === 0 && (
              <Table.Row>
                <Table.Cell>
                  <i>{"You don't have any API Keys yet"}</i>
                </Table.Cell>
              </Table.Row>
            )}
            {apiKeys.map((key) => (
              <Table.Row>
                <Table.Cell>
                  <Icon name="key" />
                  {` ${key.name}`}
                </Table.Cell>
                <Table.Cell collapsing textAlign="left">
                  {formatRelative(new Date(key.createdAt), new Date())}
                </Table.Cell>
                <Table.Cell collapsing textAlign="right">
                  <Button
                    icon="trash"
                    basic
                    negative
                    size="tiny"
                    onClick={() => _onRemoveConfirmation(key)}
                  />
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </Segment>

      <TransitionablePortal open={!!createdKey.id}>
        <Modal open={!!createdKey.id} onClose={() => setCreatedKey({})}>
          <Modal.Header>Your new API Key</Modal.Header>
          <Modal.Content>
            <p>{"Congrats! your new API key has been created."}</p>
            <p>{"This is the only time we show you the code, so please copy it before closing this window."}</p>

            <Form>
              <Form.Field>
                <label>Your new API Key</label>
                <Input
                  value={createdKey.token}
                />
              </Form.Field>
              <Form.Field>
                <Popup
                  trigger={(
                    <Button
                      basic
                      icon={tokenCopied ? "checkmark" : "clipboard"}
                      color={tokenCopied ? "green" : null}
                      onClick={_onCopyToken}
                      content="Copy the key"
                    />
                  )}
                  inverted
                  content="Copy the URL to the clipboard"
              />
              </Form.Field>
            </Form>
          </Modal.Content>
          <Modal.Actions>
            <Button
              content="Close"
              onClick={() => setCreatedKey({})}
            />
          </Modal.Actions>
        </Modal>
      </TransitionablePortal>

      <TransitionablePortal open={createMode}>
        <Modal open={createMode} onClose={() => setCreateMode(false)}>
          <Modal.Header>Create a new API Key</Modal.Header>
          <Modal.Content>
            <p>{"The API key will give the same access to your team as your current account. Please make sure you do not misplace the key."}</p>

            <Form>
              <Form.Field>
                <label>Enter a name to remember it later</label>
                <Input
                  value={newKey}
                  onChange={(e, data) => setNewKey(data.value)}
                  placeholder="Enter a name here"
                />
              </Form.Field>
            </Form>
          </Modal.Content>
          <Modal.Actions>
            <Button
              content="Close"
              onClick={() => setCreateMode(false)}
            />
            <Button
              content="Create the key"
              primary
              onClick={_onCreateKey}
              loading={createLoading}
              disabled={!newKey}
            />
          </Modal.Actions>
        </Modal>
      </TransitionablePortal>

      <TransitionablePortal open={!!confirmDelete}>
        <Modal basic open={!!confirmDelete} onClose={() => setConfirmDelete(false)}>
          <Modal.Header>Are you sure you want to delete the key?</Modal.Header>
          <Modal.Content>
            <p>{"This key will lose access to Chartbrew. This action cannot be undone."}</p>
          </Modal.Content>
          <Modal.Actions>
            <Button
              content="Go back"
              onClick={() => setConfirmDelete(false)}
              />
            <Button
              content="Remove the key permanently"
              negative
              onClick={_onRemoveKey}
              loading={createLoading}
              />
          </Modal.Actions>
        </Modal>
      </TransitionablePortal>
    </div>
  );
}

ApiKeys.propTypes = {
  teamId: PropTypes.number.isRequired,
};

export default ApiKeys;
