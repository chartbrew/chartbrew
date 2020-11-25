import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Segment, Form, Button, Header, Label, Message, Placeholder,
  Container, Menu, List, Icon,
} from "semantic-ui-react";
import AceEditor from "react-ace";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
/*
  A form for creating a new Postgres connection
*/
function PostgresConnectionForm(props) {
  const {
    editConnection, projectId, onComplete, addError, onTest, testResult,
  } = props;

  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [connection, setConnection] = useState({ type: "postgres" });
  const [errors, setErrors] = useState({});
  const [formStyle, setFormStyle] = useState("string");
  const [hideString, setHideString] = useState(true);

  useEffect(() => {
    _init();
  }, []);

  const _init = () => {
    if (editConnection) {
      const newConnection = editConnection;

      if (!newConnection.connectionString && newConnection.host) {
        setFormStyle("form");
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
    if (formStyle === "form" && !connection.host) {
      setTimeout(() => {
        setErrors({ ...errors, host: "Please enter a host name or IP address for your database" });
      }, 100);
      return;
    }
    if (formStyle === "string" && !connection.connectionString) {
      setTimeout(() => {
        setErrors({ ...errors, connectionString: "Please enter a connection string first" });
      }, 100);
      return;
    }

    const newConnection = connection;
    // Clean the connection string if the form style is Form
    if (formStyle === "form") {
      newConnection.connectionString = "";
    }

    // add the project ID
    newConnection.project_id = projectId;
    setConnection(newConnection);

    setTimeout(() => {
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
        <Header as="h3" style={{ marginBottom: 20 }}>Add a new PostgreSQL connection</Header>

        <Menu secondary>
          <Menu.Item
            name="Connection string"
            active={formStyle === "string"}
            onClick={() => setFormStyle("string")}
          />
          <Menu.Item
            name="Connection form"
            active={formStyle === "form"}
            onClick={() => setFormStyle("form")}
          />
        </Menu>

        {formStyle === "string" && (
          <div style={styles.formStyle}>
            <Form>
              <Form.Group>
                <Form.Field width={6}>
                  <label>Name your PostgreSQL connection</label>
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
              </Form.Group>
              <Form.Field>
                <label>Enter your Postgres connection string</label>
                {connection.connectionString && (
                  <label style={{ fontWeight: "normal" }}>
                    {"postgres://username:password@postgres.example.com:5432/dbname"}
                  </label>
                )}
                <Form.Input
                  placeholder="postgres://username:password@postgres.example.com:5432/dbname"
                  value={connection.connectionString || ""}
                  onChange={(e, data) => {
                    setConnection({ ...connection, connectionString: data.value });
                  }}
                  type={hideString ? "password" : "text"}
                  action={{
                    content: hideString ? "Show string" : "Hide string",
                    labelPosition: "right",
                    icon: hideString ? "eye" : "eye slash",
                    onClick: () => setHideString(!hideString),
                  }}
                />
                {errors.connectionString && (
                  <Label basic color="red" pointing>
                    {errors.connectionString}
                  </Label>
                )}
              </Form.Field>
            </Form>
          </div>
        )}

        {formStyle === "form" && (
          <div style={styles.formStyle}>
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

              <Form.Group widths={2}>
                <Form.Field error={!!errors.host} required width={10}>
                  <label>The hostname of your API</label>
                  <Form.Input
                    placeholder="postgres.example.com"
                    value={connection.host || ""}
                    onChange={(e, data) => {
                      setConnection({ ...connection, host: data.value });
                    }}
                  />
                  {errors.host
                    && (
                    <Label basic color="red" pointing>
                      {errors.host}
                    </Label>
                    )}
                </Form.Field>
                <Form.Field width={6}>
                  <label>Port</label>
                  <Form.Input
                    placeholder="Optional, defaults to 5432"
                    value={connection.port}
                    onChange={(e, data) => {
                      setConnection({ ...connection, port: data.value });
                    }}
                  />
                </Form.Field>
              </Form.Group>

              <Form.Group widths={3}>
                <Form.Field width={6}>
                  <label>Database name</label>
                  <Form.Input
                    placeholder="Enter your database name"
                    value={connection.dbName}
                    onChange={(e, data) => setConnection({ ...connection, dbName: data.value })}
                  />
                </Form.Field>
                <Form.Field width={5}>
                  <label>Username</label>
                  <Form.Input
                    placeholder="Enter your database username"
                    value={connection.username}
                    onChange={(e, data) => setConnection({ ...connection, username: data.value })}
                  />
                </Form.Field>
                <Form.Field width={5}>
                  <label>Password</label>
                  <Form.Input
                    placeholder="Enter your database password"
                    type="password"
                    onChange={(e, data) => setConnection({ ...connection, password: data.value })}
                  />
                </Form.Field>
              </Form.Group>
            </Form>
          </div>
        )}

        <List style={styles.helpList} relaxed animated>
          <List.Item
            icon="linkify"
            content="For security reasons, connect to your PostgreSQL database with read-only credentials"
            as="a"
            target="_blank"
            rel="noopener noreferrer"
            href="https://gist.github.com/oinopion/4a207726edba8b99fd0be31cb28124d0"
          />
          <List.Item
            icon="linkify"
            content="Find out how to allow remote connections to your PostgreSQL database"
            as="a"
            href="https://coderwall.com/p/cr2a1a/allowing-remote-connections-to-your-postgresql-vps-installation"
            target="_blank"
            rel="noopener noreferrer"
          />
        </List>

        {addError
          && (
          <Message negative>
            <Message.Header>{"Server error while trying to save your connection"}</Message.Header>
            <p>Please try adding your connection again.</p>
          </Message>
          )}

        <Container fluid textAlign="right">
          <Button
            primary
            basic
            onClick={() => _onCreateConnection(true)}
            loading={testLoading}
          >
            Test connection
          </Button>
          {!editConnection
            && (
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
          {editConnection
            && (
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
              {testResult.status < 400 ? "Your connection works!" : "We couldn't connect"}
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
  helpList: {
    display: "inline-block",
  },
  saveBtn: {
    marginRight: 0,
  },
};

PostgresConnectionForm.defaultProps = {
  onComplete: () => {},
  onTest: () => {},
  editConnection: null,
  addError: false,
  testResult: null,
};

PostgresConnectionForm.propTypes = {
  onComplete: PropTypes.func,
  onTest: PropTypes.func,
  projectId: PropTypes.string.isRequired,
  editConnection: PropTypes.object,
  addError: PropTypes.bool,
  testResult: PropTypes.object,
};

export default PostgresConnectionForm;
