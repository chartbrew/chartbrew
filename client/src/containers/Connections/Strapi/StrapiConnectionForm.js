import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";

import {
  Button,
  Container, Grid, Input, Loading, Row, Spacer, Text, useTheme,
} from "@nextui-org/react";
import { CloseSquare, Plus } from "react-iconly";
import uuid from "uuid/v4";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import HelpBanner from "../../../components/HelpBanner";
import connectionImages from "../../../config/connectionImages";

/*
  The Form used to create a Strapi API connection
*/
function StrapiConnectionForm(props) {
  const {
    editConnection, projectId, onComplete, addError, onTest,
  } = props;

  const [loading, setLoading] = useState(false);
  const [connection, setConnection] = useState({
    type: "api",
    subType: "strapi",
    optionsArray: [],
    name: "Strapi",
    authentication: { type: "bearer_token" },
  });
  const [errors, setErrors] = useState({});

  const { isDark } = useTheme();

  useEffect(() => {
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
        onTest(newConnection);
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
            {!editConnection && "Connect to Strapi"}
            {editConnection && `Edit ${editConnection.name}`}
          </Text>
        </Row>
        <Spacer y={0.5} />
        <Row>
          <HelpBanner
            title="How to visualize your Strapi data with Chartbrew"
            description="Chartbrew can connect to your Strapi's API to fetch data that can be visualized in a dashboard. You can use the data from your API to create charts and tables that will be updated in real-time."
            url={"https://chartbrew.com/blog/create-your-strapi-visualization-dashboard-with-chartbrew/"}
            imageUrl={connectionImages(isDark).strapi}
            info="5 min read"
          />
        </Row>
        <Spacer y={1} />
        <div style={styles.formStyle}>
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
              css={{ mw: 500 }}
            />
          </Row>
          {errors.name && (
            <Row>
              <Text color="error">
                {errors.name}
              </Text>
            </Row>
          )}

          <Spacer y={1} />
          <Row>
            <Input
              label="Strapi API URL"
              placeholder="https://yourstrapi.com/api"
              value={connection.host || ""}
              onChange={(e) => {
                setConnection({ ...connection, host: e.target.value });
              }}
              fullWidth
              color={errors.host ? "error" : "default"}
              bordered
              css={{ mw: 500 }}
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
          <Row>
            <Input.Password
              label="Strapi API token"
              placeholder="Enter the API token"
              value={connection?.authentication?.token || ""}
              onChange={(e) => _onChangeAuthParams("token", e.target.value)}
              fullWidth
              color={errors.authentication ? "error" : "default"}
              bordered
              css={{ mw: 500 }}
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
          <Row>
            <Text h5>
              Global headers to send with the requests
            </Text>
          </Row>
          <Row>
            <Text>
              {"These headers are optional and will be included with all the data requests that go to Strapi"}
            </Text>
          </Row>

          <Container>
            <Grid.Container gap={2}>
              {connection.optionsArray && connection.optionsArray.map((option) => {
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
                        light
                        color="warning"
                      />
                    </Grid>
                    <Grid xs={0} sm={4} />
                  </>
                );
              })}
            </Grid.Container>
          </Container>
          <Container>
            <Spacer y={0.5} />
            <Button
              size="sm"
              icon={<Plus />}
              onClick={_addOption}
              light
              auto
            >
              Add a header
            </Button>
          </Container>
        </div>

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

StrapiConnectionForm.defaultProps = {
  editConnection: null,
  addError: null,
};

StrapiConnectionForm.propTypes = {
  onComplete: PropTypes.func.isRequired,
  onTest: PropTypes.func.isRequired,
  projectId: PropTypes.string.isRequired,
  editConnection: PropTypes.object,
  addError: PropTypes.bool,
};

export default StrapiConnectionForm;
