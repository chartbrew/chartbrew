import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Container, Row, Spacer, Text, Link, Input, Grid, Checkbox, Tooltip, Button, Loading,
  useTheme,
} from "@nextui-org/react";
import {
  ChevronRight, CloseSquare, InfoCircle, Plus
} from "react-iconly";
import { FaExternalLinkSquareAlt } from "react-icons/fa";
import uuid from "uuid/v4";
import AceEditor from "react-ace";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import Badge from "../../../components/Badge";

/*
  The MongoDB connection form
*/
function MongoConnectionForm(props) {
  const {
    editConnection, projectId, onComplete, addError, testResult, onTest,
  } = props;

  const [showIp, setShowIp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [connection, setConnection] = useState({ type: "mongodb", optionsArray: [], srv: false });
  const [errors, setErrors] = useState({});
  const [formStyle, setFormStyle] = useState("string");

  const { isDark } = useTheme();

  useEffect(() => {
    _init();
  }, []);

  const _init = () => {
    if (editConnection) {
      const newConnection = editConnection;
      // format the options
      if (newConnection.options && newConnection.options.length > 0) {
        const newOptions = [];
        const formattedOptions = newConnection.options;
        for (let i = 0; i < formattedOptions.length; i++) {
          const optionKey = Object.keys(formattedOptions[i])[0];
          const optionValue = Object.values(formattedOptions[i])[0];

          newOptions.push({
            id: uuid(),
            key: optionKey,
            value: optionValue,
          });
        }

        if (newOptions) {
          newConnection.optionsArray = newOptions;
        } else {
          newConnection.optionsArray = [];
        }
      } else {
        newConnection.optionsArray = [];
      }

      setConnection(newConnection);

      if (!newConnection.connectionString && newConnection.host) {
        setFormStyle("form");
      }
    }
  };

  const _onCreateConnection = (test = false) => {
    setErrors({});

    if (formStyle === "form") {
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
      if (!connection.dbName) {
        setTimeout(() => {
          setErrors({ ...errors, dbName: "Please enter your database name" });
        }, 100);
        return;
      }
    }

    if (formStyle === "string") {
      if (!connection.name || connection.name.length > 24) {
        setTimeout(() => {
          setErrors({ ...errors, name: "Please enter a name which is less than 24 characters" });
        }, 100);
        return;
      }

      if (!connection.connectionString) {
        setTimeout(() => {
          setErrors({ ...errors, connectionString: "Please enter a connection string first" });
        }, 100);
        return;
      }
    }

    const newConnection = connection;

    // Clean the connection string if the form style is Form
    if (formStyle === "form") {
      newConnection.connectionString = "";
    }

    // prepare the options
    const tempOptions = newConnection.optionsArray;
    const newOptions = [];
    if (newConnection.optionsArray.length > 0) {
      for (let i = 0; i < tempOptions.length; i++) {
        if (tempOptions[i].key && tempOptions[i].value) {
          newOptions.push({ [tempOptions[i].key]: tempOptions[i].value });
        }
      }
    }

    newConnection.options = newOptions;
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

  const _onChangeSrv = () => {
    if (!connection.srv) {
      setConnection({ ...connection, srv: true });
    } else {
      setConnection({ ...connection, srv: false });
    }
  };

  const _addOption = () => {
    const option = {
      id: uuid(),
      key: "",
      value: "",
    };
    setConnection({
      ...connection, optionsArray: [...connection.optionsArray, option]
    });
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
          <Text h3>Connect to a MongoDB database</Text>
        </Row>
        <Spacer y={1} />
        <Row align="center" style={styles.formStyle}>
          <Link
            css={{
              background: formStyle === "string" ? "$background" : "$backgroundContrast",
              p: 5,
              pr: 10,
              pl: 10,
              br: "$sm"
            }}
            onClick={() => setFormStyle("string")}
          >
            <Text>Connection string</Text>
          </Link>
          <Spacer x={0.5} />
          <Link
            css={{
              background: formStyle === "form" ? "$background" : "$backgroundContrast",
              p: 5,
              pr: 10,
              pl: 10,
              br: "$sm"
            }}
            onClick={() => setFormStyle("form")}
          >
            <Text>Connection form</Text>
          </Link>
        </Row>

        {formStyle === "string" && (
          <>
            <Row align="center">
              <Input
                label="Name your connection"
                placeholder="Enter a name that you can recognise later"
                value={connection.name || ""}
                onChange={(e) => {
                  setConnection({ ...connection, name: e.target.value });
                }}
                color={errors.name ? "error" : "default"}
                bordered
                fullWidth
              />
            </Row>
            {errors.name && (
              <Row>
                <Text color="error">
                  {errors.name}
                </Text>
              </Row>
            )}
            <Spacer y={0.5} />
            <Row align="center">
              <Input.Password
                label="Enter your MongoDB connection string"
                placeholder="mongodb://username:password@mongodb.example.com:27017/dbname"
                value={connection.connectionString || ""}
                onChange={(e) => {
                  setConnection({ ...connection, connectionString: e.target.value });
                }}
                helperText={"mongodb://username:password@mongodb.example.com:27017/dbname"}
                bordered
                fullWidth
              />
            </Row>
            {errors.connectionString && (
              <Row>
                <Text color="error">
                  {errors.connectionString}
                </Text>
              </Row>
            )}
            <Spacer y={0.5} />
          </>
        )}

        {formStyle === "form" && (
          <Row>
            <Grid.Container gap={1.5}>
              <Grid xs={12} sm={8}>
                <Input
                  label="Name your connection"
                  placeholder="Enter a name that you can recognise later"
                  value={connection.name || ""}
                  onChange={(e) => {
                    setConnection({ ...connection, name: e.target.value });
                  }}
                  helperColor="error"
                  helperText={errors.name}
                  bordered
                  fullWidth
                />
              </Grid>

              <Grid xs={12} sm={10} md={8}>
                <Input
                  label="Hostname or IP address"
                  placeholder="'yourmongodomain.com' or '0.0.0.0' "
                  value={connection.host || ""}
                  onChange={(e) => {
                    setConnection({ ...connection, host: e.target.value });
                  }}
                  helperColor="error"
                  helperText={errors.host}
                  bordered
                  fullWidth
                />
              </Grid>
              <Grid xs={12} sm={2} md={4}>
                <Input
                  label="Port"
                  placeholder="Leave empty if using the default"
                  value={connection.port || ""}
                  onChange={(e) => {
                    setConnection({ ...connection, port: e.target.value });
                  }}
                  helperColor="error"
                  helperText={errors.port}
                  bordered
                  fullWidth
                />
              </Grid>

              <Grid xs={12} sm={4} md={4}>
                <Input
                  label="Database name"
                  placeholder="Enter your database name"
                  value={connection.dbName || ""}
                  onChange={(e) => {
                    setConnection({ ...connection, dbName: e.target.value });
                  }}
                  helperColor="error"
                  helperText={errors.dbName}
                  bordered
                  fullWidth
                />
              </Grid>

              <Grid xs={12} sm={4} md={4}>
                <Input
                  label="Database username"
                  placeholder="Username"
                  value={connection.username || ""}
                  onChange={(e) => {
                    setConnection({ ...connection, username: e.target.value });
                  }}
                  helperColor="error"
                  helperText={errors.username}
                  bordered
                  fullWidth
                />
              </Grid>

              <Grid xs={12} sm={4} md={4}>
                <Input.Password
                  label="Database password"
                  placeholder="Database user password"
                  onChange={(e) => {
                    setConnection({ ...connection, password: e.target.value });
                  }}
                  helperColor="error"
                  helperText={errors.password}
                  bordered
                  fullWidth
                />
              </Grid>

              <Grid xs={12}>
                <Checkbox
                  defaultChecked={connection.srv}
                  onChange={_onChangeSrv}
                  size="sm"
                >
                  Use MongoDB 3.6 SRV URI connection string
                </Checkbox>
                <Tooltip
                  content="Tick this if your connection URI contains 'mongodb+srv://'"
                  placement="left"
                >
                  <InfoCircle />
                </Tooltip>
              </Grid>

              {connection.optionsArray.length > 0 && (
                <Grid xs={12}>
                  <Text h5>Connection options</Text>
                </Grid>
              )}
              {connection.optionsArray.map((option) => {
                return (
                  <>
                    <Grid xs={12} sm={4}>
                      <Input
                        placeholder="Key"
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
                        color="error"
                      />
                    </Grid>
                    <Grid xs={0} sm={4} />
                  </>
                );
              })}
              <Grid xs={12}>
                <Button
                  size="sm"
                  iconRight={<Plus />}
                  onClick={_addOption}
                  ghost
                  auto
                >
                  Add options
                </Button>
              </Grid>
            </Grid.Container>
          </Row>
        )}

        <Spacer y={1} />
        <Row xs={12}>
          <Container css={{ backgroundColor: "$blue50", br: "$md", p: 20 }} md>
            <Row>
              <Text b>Avoid using credentials that can write data</Text>
            </Row>
            <Row>
              <Text>{"Out of abundance of caution, we recommend all our users to connect only with read permissions. Don't use mongo users with readWrite permissions."}</Text>
            </Row>
            <Row>
              <Link href="https://docs.mongodb.com/manual/reference/method/db.createUser/" target="_blank" rel="noopener noreferrer">
                Check this link on how to do it
              </Link>
            </Row>
          </Container>
        </Row>
        <Spacer y={0.5} />
        <Row align="center">
          <ChevronRight />
          <Spacer x={0.2} />
          <Link
            target="_blank"
            rel="noopener noreferrer"
            href="https://docs.mongodb.com/manual/reference/connection-string/"
          >
            <Text>Find out more about MongoDB connection strings</Text>
          </Link>
          <Spacer x={0.2} />
          <FaExternalLinkSquareAlt size={12} />
        </Row>
        <Row align="center">
          <ChevronRight />
          <Spacer x={0.2} />
          <Link
            href="https://docs.mongodb.com/guides/cloud/connectionstring/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Text>Find out how to get your MongoDB Atlas connection string</Text>
          </Link>
          <Spacer x={0.2} />
          <FaExternalLinkSquareAlt size={12} />
        </Row>
        <Row align="center">
          <ChevronRight />
          <Spacer x={0.2} />
          <Link onClick={() => setShowIp(!showIp)}>
            <Text>Front-end and back-end on different servers?</Text>
          </Link>
        </Row>
        <Spacer y={0.5} />
        {showIp && (
          <Row>
            <Container css={{ backgroundColor: "$blue100", p: 10, br: "$sm" }}>
              <Row>
                <Text h5>{"You might need to whitelist the front-end IP in the back-end"}</Text>
              </Row>
              <Row>
                <Text>{"This is sometimes required when the database and the Chartbrew app are running on separate servers."}</Text>
              </Row>
            </Container>
          </Row>
        )}
        {addError && (
          <Row>
            <Container css={{ backgroundColor: "$red300", p: 10 }}>
              <Row>
                <Text h5>{"Server error while trying to save your connection"}</Text>
              </Row>
              <Row>
                <Text>Please try adding your connection again.</Text>
              </Row>
            </Container>
          </Row>
        )}
        <Spacer y={1} />
        <Row>
          <Button
            ghost
            auto
            onClick={() => _onCreateConnection(true)}
            disabled={testLoading}
          >
            {testLoading && <Loading type="points" color="currentColor" />}
            {!testLoading && "Test connection"}
          </Button>
          <Spacer x={0.2} />
          <Button
            disabled={loading}
            onClick={_onCreateConnection}
            auto
          >
            {loading && <Loading type="points" color="currentColor" />}
            {!loading && "Save connection"}
          </Button>
        </Row>
      </Container>

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
        <Container
          css={{
            backgroundColor: "$backgroundContrast", br: "$md", p: 20, mt: 20
          }}
          md
        >
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
  helpList: {
    display: "inline-block",
  },
  saveBtn: {
    marginRight: 0,
  },
};

MongoConnectionForm.defaultProps = {
  onComplete: () => {},
  onTest: () => {},
  editConnection: null,
  addError: false,
  testResult: null,
};

MongoConnectionForm.propTypes = {
  onComplete: PropTypes.func,
  onTest: PropTypes.func,
  projectId: PropTypes.string.isRequired,
  editConnection: PropTypes.object,
  addError: PropTypes.bool,
  testResult: PropTypes.object,
};

export default MongoConnectionForm;
