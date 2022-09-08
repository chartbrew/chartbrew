import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";

import {
  Button,
  Container, Divider, Dropdown, Grid, Input, Loading, Row, Spacer, Text, useTheme,
} from "@nextui-org/react";
import { CloseSquare, Plus } from "react-iconly";
import uuid from "uuid/v4";
import AceEditor from "react-ace";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import Badge from "../../../components/Badge";

const authTypes = [{
  key: "no_auth",
  text: "No auth",
  value: "no_auth",
}, {
  key: "basic_auth",
  text: "Basic auth",
  value: "basic_auth",
}, {
  key: "bearer_token",
  text: "Bearer token",
  value: "bearer_token",
}];

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
  const [menuType, setMenuType] = useState("authentication");

  const { isDark } = useTheme();

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
        onComplete(newConnection)
          .then(() => setLoading(false))
          .catch(() => setLoading(false));
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

  const _onChangeAuthParams = (type, value) => {
    const auth = connection.authentication || {};
    auth[type] = value;

    setConnection({ ...connection, authentication: auth });
  };

  return (
    <div style={styles.container}>
      <Container
        css={{
          backgroundColor: "$backgroundContrast",
          br: "$md",
          p: 10,
          "@xs": {
            p: 20,
          },
          "@sm": {
            p: 20,
          },
          "@md": {
            p: 20,
          },
        }}
        md
      >
        <Row align="center">
          <Text h3>
            {!editConnection && "Add a new API host"}
            {editConnection && `Edit ${editConnection.name}`}
          </Text>
        </Row>
        <Spacer y={1} />
        <Row align="center" style={styles.formStyle}>
          <Grid.Container gap={1}>
            <Grid xs={12} sm={12} md={5}>
              <Container>
                <Row>
                  <Input
                    label="Enter a name for your connection"
                    placeholder="Enter a name you can recognize later"
                    value={connection.name || ""}
                    onChange={(e) => {
                      setConnection({ ...connection, name: e.target.value });
                    }}
                    color={errors.name ? "error" : "default"}
                    fullWidth
                    bordered
                  />
                </Row>
                {errors.name && (
                  <Row>
                    <Text color="error">
                      {errors.name}
                    </Text>
                  </Row>
                )}
              </Container>
            </Grid>

            <Grid xs={12} sm={12} md={7}>
              <Container>
                <Row>
                  <Input
                    label="The hostname of your API"
                    placeholder="https://api.example.com"
                    value={connection.host || ""}
                    onChange={(e) => {
                      setConnection({ ...connection, host: e.target.value });
                    }}
                    fullWidth
                    color={errors.host ? "error" : "default"}
                    bordered
                  />
                </Row>
                {errors.host && (
                  <Row>
                    <Text color="error">
                      {errors.host}
                    </Text>
                  </Row>
                )}
                <Spacer y={1} />
              </Container>
            </Grid>

            <Grid sm={12} md={12}>
              <Container>
                <Row>
                  <Button
                    color="secondary"
                    ghost={menuType !== "authentication"}
                    onClick={() => setMenuType("authentication")}
                    auto
                    size="sm"
                  >
                    Authentication
                  </Button>
                  <Spacer x={0.2} />
                  <Button
                    color="secondary"
                    ghost={menuType !== "headers"}
                    onClick={() => setMenuType("headers")}
                    iconRight={(
                      <Badge type="primary">
                        {connection.optionsArray.length}
                      </Badge>
                    )}
                    auto
                    size="sm"
                  >
                    Headers
                  </Button>
                </Row>
              </Container>
            </Grid>

            <Grid xs={12}>
              <Container>
                <Spacer y={1} />
                <Divider />
                <Spacer y={1} />
              </Container>
            </Grid>

            {menuType === "authentication" && (
              <Grid xs={12}>
                <Grid.Container gap={2}>
                  <Grid xs={12} sm={4}>
                    <Container>
                      <Row>
                        <Dropdown
                          options={authTypes}
                          selection
                          fluid
                          defaultValue="no_auth"
                          value={connection.authentication && connection.authentication.type}
                          onChange={(e) => _onChangeAuthParams("type", e.target.value)}
                        >
                          <Dropdown.Trigger>
                            <Input
                              label="Select an authentication type"
                              initialValue="Authentication type"
                              value={connection.authentication && connection.authentication.type}
                              fullWidth
                            />
                          </Dropdown.Trigger>
                          <Dropdown.Menu
                            onAction={(key) => _onChangeAuthParams("type", key)}
                            selectedKeys={[
                              connection.authentication && connection.authentication.type
                            ]}
                            selectionMode="single"
                          >
                            {authTypes.map((type) => (
                              <Dropdown.Item key={type.value}>
                                {type.text}
                              </Dropdown.Item>
                            ))}
                          </Dropdown.Menu>
                        </Dropdown>
                      </Row>
                    </Container>
                  </Grid>
                  {connection.authentication && connection.authentication.type === "basic_auth" && (
                    <Grid xs={12} sm={5}>
                      <Container>
                        <Row align="center">
                          <Input
                            label="Enter a Username or API Key"
                            placeholder="Username or API Key"
                            onChange={(e) => _onChangeAuthParams("user", e.target.value)}
                            value={connection.authentication.user}
                            fullWidth
                            bordered
                          />
                        </Row>
                        <Spacer y={0.5} />
                        <Row align="center">
                          <Input.Password
                            label="Enter a Password or API Key Value"
                            placeholder="Password or API Key Value"
                            onChange={(e) => _onChangeAuthParams("pass", e.target.value)}
                            value={connection.authentication.pass}
                            fullWidth
                            bordered
                          />
                        </Row>
                      </Container>
                    </Grid>
                  )}
                  {connection.authentication && connection.authentication.type === "bearer_token" && (
                    <Grid xs={12} sm={5}>
                      <Input.Password
                        label="Enter the token"
                        placeholder="Authentication token"
                        onChange={(e) => _onChangeAuthParams("token", e.target.value)}
                        value={connection.authentication.token}
                        fullWidth
                        bordered
                      />
                    </Grid>
                  )}
                </Grid.Container>
              </Grid>
            )}

            {menuType === "headers" && (
              <Grid md={12}>
                <Container>
                  <Row>
                    <Text h5>
                      Global headers to send with the requests
                    </Text>
                  </Row>
                  <Row>
                    <Text>
                      {"These headers will be included with all the future requests"}
                    </Text>
                  </Row>
                </Container>
              </Grid>
            )}

            <Grid md={12}>
              <Container>
                <Grid.Container gap={2}>
                  {menuType === "headers" && connection.optionsArray && connection.optionsArray.map((option) => {
                    return (
                      <>
                        <Grid xs={12} sm={4}>
                          <Input
                            placeholder="Header name"
                            value={option.key}
                            onChange={(e) => _onChangeOption(option.id, e.target.value, "key")}
                            fullWidth
                          />
                        </Grid>
                        <Grid xs={12} sm={4}>
                          <Input
                            onChange={(e) => _onChangeOption(option.id, e.target.value, "value")}
                            value={option.value}
                            placeholder="Value"
                            fullWidth
                          />
                          <Spacer x={0.5} />
                          <Button
                            icon={<CloseSquare />}
                            onClick={() => _removeOption(option.id)}
                            auto
                            flat
                            color="warning"
                          />
                        </Grid>
                        <Grid xs={0} sm={4} />
                      </>
                    );
                  })}
                </Grid.Container>
              </Container>
            </Grid>
            {menuType === "headers" && (
              <Grid xs={12}>
                <Container>
                  <Spacer y={0.5} />
                  <Button
                    size="sm"
                    iconRight={<Plus />}
                    onClick={_addOption}
                    bordered
                    auto
                  >
                    Add a header
                  </Button>
                </Container>
              </Grid>
            )}
          </Grid.Container>
        </Row>

        {addError && (
          <>
            <Spacer y={1} />
            <Row>
              <Text b color="error">{"Server error while trying to save your connection"}</Text>
              <br />
              <Text color="error">Please try adding your connection again.</Text>
            </Row>
          </>
        )}

        <Spacer y={2} />
        <Row align="center">
          <Button
            ghost
            onClick={() => _onCreateConnection(true)}
            disabled={testLoading}
            auto
          >
            {testLoading && <Loading type="points" color="currentColor" />}
            {!testLoading && "Test connection"}
          </Button>
          <Spacer x={0.2} />
          {!editConnection && (
            <Button
              disabled={loading}
              onClick={_onCreateConnection}
              auto
            >
              {loading && <Loading type="points" color="currentColor" />}
              {!loading && "Save connection"}
            </Button>
          )}
          {editConnection && (
            <Button
              disabled={loading}
              onClick={_onCreateConnection}
              auto
            >
              {loading && <Loading type="points" color="currentColor" />}
              {!loading && "Save connection"}
            </Button>
          )}
        </Row>
      </Container>
      <Spacer y={2} />

      {testLoading && (
        <Container css={{ backgroundColor: "$backgroundContrast", br: "$md", p: 20 }} md>
          <Row align="center">
            <Loading type="points">
              Test underway...
            </Loading>
          </Row>
          <Spacer y={2} />
        </Container>
      )}

      {testResult && !testLoading && (
        <Container css={{ backgroundColor: "$backgroundContrast", br: "$md", p: 20 }} md>
          <Row align="center">
            <Text>
              {"Test Result "}
              <Badge
                type={testResult.status < 400 ? "success" : "error"}
              >
                {`Status code: ${testResult.status}`}
              </Badge>
            </Text>
          </Row>
          <Spacer y={1} />
          <AceEditor
            mode="json"
            theme={isDark ? "one_dark" : "tomorrow"}
            style={{ borderRadius: 10 }}
            height="150px"
            width="none"
            value={testResult.body || "Hello"}
            readOnly
            name="queryEditor"
            editorProps={{ $blockScrolling: true }}
          />
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
  addError: PropTypes.bool,
  testResult: PropTypes.object,
};

export default ApiConnectionForm;
