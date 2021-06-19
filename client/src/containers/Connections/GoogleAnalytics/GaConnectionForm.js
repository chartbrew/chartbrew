/* eslint-disable react/jsx-props-no-spreading */

import React, {
  useState, useEffect,
} from "react";
import PropTypes from "prop-types";
import {
  Segment, Form, Button, Icon, Header, Label, Message, Container,
  Placeholder, Divider,
} from "semantic-ui-react";
import AceEditor from "react-ace";
import cookie from "react-cookies";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import { API_HOST } from "../../../config/settings";

/*
  The Form used to create GA connections
*/
function GaConnectionForm(props) {
  const {
    editConnection, projectId, onComplete, addError, onTest, testResult,
  } = props;

  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [connection, setConnection] = useState({ type: "googleAnalytics", optionsArray: [], name: "Google Analytics" });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    _init();
  }, []);

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
        onComplete(newConnection, true)
          .then(() => setLoading(false))
          .catch(() => setLoading(false));
      }
    }, 100);
  };

  const _onGoogleAuth = () => {
    const url = `${API_HOST}/project/${projectId}/connection/${connection.id}/google/auth`;
    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
      "Authorization": cookie.load("brewToken"),
    });

    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) return Promise.reject(response.status);

        return response.json();
      })
      .then((result) => {
        if (result.url) {
          window.location.href = result.url;
        } else {
          Promise.reject("No URL found");
        }
      })
      .catch(() => {
        setErrors({ ...errors, auth: "Cannot authenticate with Google. Please try again." });
      });
  };

  return (
    <div style={styles.container}>
      <Segment style={styles.mainSegment}>
        <Header as="h3" style={{ marginBottom: 20 }}>
          {!editConnection && "Connect to Google Analytics"}
          {editConnection && `Edit ${editConnection.name}`}
        </Header>

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
            {!editConnection && (
              <Form.Field>
                <Button
                  primary
                  loading={loading}
                  onClick={_onCreateConnection}
                  icon
                  style={styles.saveBtn}
                  disabled={!connection.name}
                >
                  {"Create connection "}
                  <Icon name="arrow right" />
                </Button>
              </Form.Field>
            )}
            {editConnection && !connection.OAuth && (
              <Form.Field>
                <Button
                  primary
                  icon="google"
                  labelPosition="right"
                  content="Authenticate with Google"
                  onClick={_onGoogleAuth}
                />
                {errors.auth && (
                  <Label basic color="red" pointing>
                    {errors.auth}
                  </Label>
                )}
              </Form.Field>
            )}
            {editConnection && connection.OAuth && (
              <Form.Field>
                <Header color="green" size="small">
                  {`Authenticated as ${connection.OAuth.email}`}
                </Header>
                <Button
                  className="tertiary"
                  primary
                  icon="refresh"
                  content="Click here to re-authenticate"
                  onClick={_onGoogleAuth}
                />
              </Form.Field>
            )}
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
            primary
            basic
            onClick={() => onTest(connection)}
            loading={testLoading}
            disabled={!connection.name || !connection.oauth_id}
          >
            Test connection
          </Button>
          {editConnection && (
            <Button
              secondary
              loading={loading}
              onClick={_onCreateConnection}
              icon
              labelPosition="right"
              style={styles.saveBtn}
              disabled={!connection.name}
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
              {`Status code: ${testResult.status}`}
            </Label>
          </Header>
          <Segment attached>
            <AceEditor
              mode="json"
              theme="tomorrow"
              height="250px"
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
  baseStyle: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "20px",
    borderWidth: 2,
    borderRadius: 2,
    borderColor: "#eeeeee",
    borderStyle: "dashed",
    backgroundColor: "#fafafa",
    color: "#bdbdbd",
    outline: "none",
    transition: "border .24s ease-in-out"
  },
  activeStyle: {
    borderColor: "#2196f3"
  },
  acceptStyle: {
    borderColor: "#00e676"
  },
  rejectStyle: {
    borderColor: "#ff1744"
  },
};

GaConnectionForm.defaultProps = {
  editConnection: null,
  addError: null,
  testResult: null,
};

GaConnectionForm.propTypes = {
  onComplete: PropTypes.func.isRequired,
  onTest: PropTypes.func.isRequired,
  projectId: PropTypes.string.isRequired,
  editConnection: PropTypes.object,
  addError: PropTypes.bool,
  testResult: PropTypes.object,
};

export default GaConnectionForm;
