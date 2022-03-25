import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Button,
  Container,
  Divider,
  Dropdown, Form, Header, Icon, Input, Label, List, Message, Placeholder, Segment, Transition
} from "semantic-ui-react";
import AceEditor from "react-ace";
import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";

import { secondary } from "../../../config/colors";

/*
** Customer.io form uses
** connection.password = API Key
** connection.host = Customer.io region
*/
function CustomerioConnectionForm(props) {
  const {
    editConnection, onTest, projectId, onComplete, addError, testResult
  } = props;

  const [connection, setConnection] = useState({ type: "customerio", host: "us", optionsArray: [] });
  const [errors, setErrors] = useState({});
  const [showInstructions, setShowInstructions] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const regionOptions = [
    {
      key: "us", value: "us", flag: "us", text: "United States"
    },
    {
      key: "eu", value: "eu", flag: "eu", text: "Europe"
    },
  ];

  useEffect(() => {
    _init();
  }, []);

  useEffect(() => {
    if (editConnection) {
      setConnection(editConnection);
    }
  }, [editConnection]);

  const _init = () => {
    if (editConnection) {
      const newConnection = editConnection;

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
    if (!connection.password) {
      setTimeout(() => {
        setErrors({ ...errors, password: "Please enter the Customer.io API Key" });
      }, 100);
      return;
    }
    if (!connection.host) {
      setTimeout(() => {
        setErrors({ ...errors, host: "Please select a region" });
      }, 100);
      return;
    }

    // add the project ID
    setConnection({ ...connection, project_id: projectId });

    setTimeout(() => {
      const newConnection = connection;
      if (!connection.id) newConnection.project_id = projectId;
      if (test === true) {
        setTestLoading(true);
        onTest(newConnection)
          .then(() => setTestLoading(false))
          .catch(() => setTestLoading(false));
      } else {
        setLoading(true);
        onComplete(newConnection)
          .then(() => setLoading(false))
          .catch(() => setLoading(false));
      }
    }, 100);
  };

  return (
    <div style={styles.container}>
      <Segment style={styles.mainSegment}>
        <Header as="h3" style={{ marginBottom: 20 }}>
          {!editConnection && "Connect to Customer.io"}
          {editConnection && `Edit ${editConnection.name}`}
        </Header>

        <div style={styles.formStyle}>
          <Form id="connection-form">
            <Form.Field error={!!errors.name}>
              <label>Name your connection</label>
              <Form.Input
                placeholder="Enter a name that you can recognise later"
                value={connection.name || ""}
                onChange={(e, data) => {
                  setConnection({ ...connection, name: data.value });
                }}
              />
              {errors.name && (
                <Label basic color="red" pointing>
                  {errors.name}
                </Label>
              )}
            </Form.Field>

            <Form.Field error={!!errors.password}>
              <label>
                {"Your Customer.io API key "}
                <Icon
                  name="question circle outline"
                  color="secondary"
                  style={{ cursor: "pointer" }}
                  onClick={() => setShowInstructions(!showInstructions)}
                />
              </label>
              <Input
                placeholder="Enter your Customer.io API key"
                value={connection.password || ""}
                type="password"
                onChange={(e, data) => {
                  setConnection({ ...connection, password: data.value });
                }}
              />
              {errors.password && (
                <Label basic color="red" pointing>
                  {errors.password}
                </Label>
              )}
            </Form.Field>
            <Form.Field>
              <Transition animation="fade down" visible={showInstructions}>
                <Message info>
                  <List divided relaxed="very" size="tiny">
                    <List.Item as="a" href="https://fly.customer.io/settings/api_credentials?keyType=app" target="_blank" rel="noreferrer noopener">
                      <List.Content>
                        <List.Header style={{ color: secondary }}>
                          {"1. Create a Customer.io App API Key "}
                          <Icon name="external alternate" />
                        </List.Header>
                      </List.Content>
                    </List.Item>

                    <List.Item>
                      <List.Content>
                        <List.Header>{"2. (Optional) Add your server's IP address to the allowlist"}</List.Header>
                      </List.Content>
                    </List.Item>

                    <List.Item>
                      <List.Content>
                        <List.Header>{"3. Copy and paste the API Key here"}</List.Header>
                      </List.Content>
                    </List.Item>
                  </List>
                  <Divider hidden />
                </Message>
              </Transition>
            </Form.Field>

            <Form.Field>
              <label>
                {"Where is your Customer.io data located? "}
                <a href="https://fly.customer.io/settings/privacy" target="_blank" rel="noopener noreferrer">
                  <Icon
                    name="external"
                    color="secondary"
                  />
                </a>
              </label>
              <Dropdown
                selection
                options={regionOptions}
                defaultValue={"us"}
                value={connection.host || ""}
                onChange={(e, data) => {
                  setConnection({ ...connection, host: data.value });
                }}
              />
            </Form.Field>
          </Form>
        </div>

        {addError
          && (
            <Message negative>
              <Message.Header>{"Server error while trying to save your connection"}</Message.Header>
              <p>Please try adding your connection again.</p>
            </Message>
          )}

        <Divider hidden />
        <Container fluid textAlign="right">
          <Button
            type="submit"
            for="connection-form"
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
              loading={loading}
              onClick={_onCreateConnection}
              icon
              labelPosition="right"
              style={styles.saveBtn}
            >
              <Icon name="checkmark" />
              Save connection
            </Button>
          )}
          {editConnection && (
            <Button
              secondary
              loading={loading}
              onClick={_onCreateConnection}
              icon
              labelPosition="right"
              style={styles.saveBtn}
            >
              <Icon name="checkmark" />
              Save changes
            </Button>
          )}
        </Container>
      </Segment>

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
              {testResult.status < 400 ? "Success!" : "Couldn't connect"}
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
  mainSegment: {
    padding: 20,
  },
  formStyle: {
    marginTop: 20,
    marginBottom: 20,
  },
  saveBtn: {
    marginRight: 0,
  },
};

CustomerioConnectionForm.defaultProps = {
  editConnection: null,
  addError: null,
  testResult: null,
};

CustomerioConnectionForm.propTypes = {
  onComplete: PropTypes.func.isRequired,
  onTest: PropTypes.func.isRequired,
  projectId: PropTypes.string.isRequired,
  editConnection: PropTypes.object,
  addError: PropTypes.bool,
  testResult: PropTypes.object,
};

export default CustomerioConnectionForm;
