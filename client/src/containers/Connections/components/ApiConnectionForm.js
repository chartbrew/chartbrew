import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Segment, Form, Button, Icon, Header, Label, Message, Container,
  Placeholder,
} from "semantic-ui-react";
import uuid from "uuid/v4";
import brace from "brace"; // eslint-disable-line
import AceEditor from "react-ace";

import "brace/mode/json";
import "brace/theme/tomorrow";

/*
  The Form used to create API connections
*/
function ApiConnectionForm(props) {
  const {
    editConnection, projectId, onComplete, addError, onTest, testResult,
  } = props;

  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [connection, setConnection] = useState({ type: "api", optionsArray: [] });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    _addOption();
    _init();
  }, []);

  const _init = () => {
    if (editConnection) {
      const newConnection = editConnection;
      // format the options
      if (newConnection.options && newConnection.options.length > 0) {
        const formattedOptions = [];
        for (let i = 0; i < newConnection.options.length; i++) {
          if (newConnection.options[i]) {
            formattedOptions.push({
              id: uuid(),
              key: Object.keys(newConnection.options[i])[0],
              value: newConnection.options[i][Object.keys(newConnection.options[i])[0]],
            });
          }
        }

        newConnection.optionsArray = formattedOptions;
      } else {
        newConnection.optionsArray = [];
      }

      setConnection(newConnection);
    }
  };

  const _onCreateConnection = (test = false) => {
    setErrors({});

    if (!connection.name || connection.name.length > 24) {
      setTimeout(() => {
        setErrors({ ...errors, name: "Please enter a name which is less than 24 characters" });
      }, 100);
      return;
    }
    if (!connection.host) {
      setTimeout(() => {
        setErrors({ ...errors, host: "Please enter a host name or IP address for your database" });
      }, 100);
      return;
    }

    // prepare the options
    const tempOptions = connection.optionsArray;
    const newOptions = [];
    if (tempOptions && tempOptions.length > 0) {
      for (let i = 0; i < tempOptions.length; i++) {
        if (tempOptions[i].key && tempOptions[i].value) {
          newOptions.push({ [tempOptions[i].key]: tempOptions[i].value });
        }
      }
    }

    // add the project ID
    setConnection({ ...connection, project_id: projectId, options: newOptions });

    setTimeout(() => {
      const newConnection = connection;
      if (!connection.id) newConnection.project_id = projectId;
      newConnection.options = newOptions;
      if (test === true) {
        setTestLoading(true);
        onTest(newConnection)
          .then(() => setTestLoading(false))
          .catch(() => setTestLoading(false));
      } else {
        setLoading(true);
        onComplete(newConnection);
      }
    }, 100);
  };

  const _addOption = () => {
    const option = {
      id: uuid(),
      key: "",
      value: "",
    };

    setConnection({ ...connection, optionsArray: [...connection.optionsArray, option] });
  };

  const _removeOption = (id) => {
    const tempOptions = connection.optionsArray;
    const newOptions = [];
    for (let i = 0; i < tempOptions.length; i++) {
      if (tempOptions[i].id !== id) {
        newOptions.push(tempOptions[i]);
      }
    }

    setConnection({ ...connection, optionsArray: newOptions });
  };

  const _onChangeOption = (id, value, selector) => {
    const tempOptions = connection.optionsArray;
    for (let i = 0; i < tempOptions.length; i++) {
      if (tempOptions[i].id === id) {
        if (tempOptions[i][selector]) tempOptions[i][selector] = "";
        tempOptions[i][selector] = value;
      }
    }

    setConnection({ ...connection, optionsArray: tempOptions });
  };

  return (
    <div style={styles.container}>
      <Header attached="top" as="h2">
        {!editConnection && "Add a new API host"}
        {editConnection && `Edit ${editConnection.name}`}
      </Header>
      <Segment attached>
        <Form>
          <Form.Field error={!!errors.name} required>
            <label>Name your connection</label>
            <Form.Input
              placeholder="Enter a name that you can recognise later"
              value={connection.name || ""}
              onChange={(e, data) => {
                setConnection({ ...connection, name: data.value });
              }}
            />
            {errors.name
              && (
              <Label basic color="red" pointing>
                {errors.name}
              </Label>
              )}
          </Form.Field>

          <Form.Field error={!!errors.host} required>
            <label>The hostname of your API</label>
            <Form.Input
              placeholder="https://api.example.com"
              value={connection.host || ""}
              onChange={(e, data) => {
                setConnection({ ...connection, host: data.value });
              }}
            />
            {errors.host && (
              <Label basic color="red" pointing>
                {errors.host}
              </Label>
            )}
          </Form.Field>

          {connection.optionsArray && connection.optionsArray.length > 0 && (
            <Header as="h5">
              Global headers to send with requests
              <Header.Subheader>
                {"This is the place where you can put your API authentication headers"}
              </Header.Subheader>
            </Header>
          )}
          {connection.optionsArray && connection.optionsArray.map((option) => {
            return (
              <Form.Group widths="equal" key={option.id}>
                <Form.Input
                  placeholder="Header name"
                  value={option.key}
                  onChange={(e, data) => _onChangeOption(option.id, data.value, "key")}
                />
                <Form.Input
                  onChange={(e, data) => _onChangeOption(option.id, data.value, "value")}
                  value={option.value}
                  placeholder="Value"
                />
                <Form.Button icon onClick={() => _removeOption(option.id)}>
                  <Icon name="close" />
                </Form.Button>
              </Form.Group>
            );
          })}
          <Form.Field>
            <Button
              size="small"
              icon
              labelPosition="right"
              onClick={_addOption}
            >
              <Icon name="plus" />
              Add more headers
            </Button>
          </Form.Field>
        </Form>

        {addError
          && (
          <Message negative>
            <Message.Header>{"Server error while trying to save your connection"}</Message.Header>
            <p>Please try adding your connection again.</p>
          </Message>
          )}
      </Segment>
      <Button.Group attached="bottom">
        <Button
          primary
          basic
          onClick={() => _onCreateConnection(true)}
          loading={testLoading}
        >
          Test connection
        </Button>
        {!editConnection && (
          <Button
            primary
            attached="bottom"
            loading={loading}
            onClick={_onCreateConnection}
          >
            Save connection
          </Button>
        )}
        {editConnection && (
          <Button
            secondary
            attached="bottom"
            loading={loading}
            onClick={_onCreateConnection}
          >
            Save changes
          </Button>
        )}
      </Button.Group>

      {testLoading && (
        <Segment>
          <Placeholder>
            <Placeholder.Line />
            <Placeholder.Line />
            <Placeholder.Line />
            <Placeholder.Line />
            <Placeholder.Line />
          </Placeholder>
        </Segment>
      )}

      {testResult && !testLoading && (
        <Container fluid style={{ marginTop: 15 }}>
          <Header attached="top">
            Test Result
            <Label
              color={testResult.status < 400 ? "green" : "orange"}
            >
              {`Status code: ${testResult.status}`}
            </Label>
          </Header>
          <Segment attached>
            <AceEditor
              mode="json"
              theme="tomorrow"
              height="150px"
              width="none"
              value={testResult.body}
              readOnly
              name="queryEditor"
              editorProps={{ $blockScrolling: true }}
            />
          </Segment>
        </Container>
      )}
    </div>
  );
}
const styles = {
  container: {
    flex: 1,
  },
};

ApiConnectionForm.defaultProps = {
  editConnection: null,
  addError: null,
  testResult: null,
};

ApiConnectionForm.propTypes = {
  onComplete: PropTypes.func.isRequired,
  onTest: PropTypes.func.isRequired,
  projectId: PropTypes.string.isRequired,
  editConnection: PropTypes.object,
  addError: PropTypes.object,
  testResult: PropTypes.object,
};

export default ApiConnectionForm;
