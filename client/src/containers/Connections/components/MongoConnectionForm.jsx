import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Spacer,Link, Input,Checkbox, Tooltip, Button, Chip, Tabs, Tab, CircularProgress,
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

import HelpBanner from "../../../components/HelpBanner";
import connectionImages from "../../../config/connectionImages";
import Container from "../../../components/Container";
import Row from "../../../components/Row";
import Text from "../../../components/Text";
import useThemeDetector from "../../../modules/useThemeDetector";

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
  const [connection, setConnection] = useState({
    type: "mongodb", subType: "mongodb", optionsArray: [], srv: false
  });
  const [errors, setErrors] = useState({});
  const [formStyle, setFormStyle] = useState("string");

  const isDark = useThemeDetector();

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
      <Container size="md">
        <Row align="center">
          <Text size="lg">Connect to a MongoDB database</Text>
        </Row>
        <Spacer y={2} />
        <Row>
          <HelpBanner
            title="How to visualize your MongoDB data with Chartbrew"
            description="Chartbrew can connect to your MongoDB database and create charts that tell you more about your data."
            url={"https://chartbrew.com/blog/how-to-visualize-your-mongodb-data-with-chartbrew/"}
            imageUrl={connectionImages(isDark).mongodb}
            info="7 min read"
          />
        </Row>
        <Spacer y={2} />
        <Row align="center" style={styles.formStyle}>
          <Tabs selectedKey={formStyle} onChange={(key) => setFormStyle(key)}>
            <Tab key="string" title="Connection string" />
            <Tab key="form" title="Connection form" />
          </Tabs>
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
                color={errors.name ? "danger" : "default"}
                bordered
                fullWidth
              />
            </Row>
            {errors.name && (
              <Row>
                <Text className={"text-danger"}>
                  {errors.name}
                </Text>
              </Row>
            )}
            <Spacer y={2} />
            <Row align="center">
              <Input
                label="Enter your MongoDB connection string"
                placeholder="mongodb://username:password@mongodb.example.com:27017/dbname"
                value={connection.connectionString || ""}
                onChange={(e) => {
                  setConnection({ ...connection, connectionString: e.target.value });
                }}
                description={"mongodb://username:password@mongodb.example.com:27017/dbname"}
                bordered
                fullWidth
              />
            </Row>
            {errors.connectionString && (
              <Row>
                <Text color="danger">
                  {errors.connectionString}
                </Text>
              </Row>
            )}
            <Spacer y={0.5} />
          </>
        )}

        {formStyle === "form" && (
          <Row>
            <div className="grid grid-cols-12 gap-1">
              <div className="col-span-12 md:col-span-8">
                <Input
                  label="Name your connection"
                  placeholder="Enter a name that you can recognise later"
                  value={connection.name || ""}
                  onChange={(e) => {
                    setConnection({ ...connection, name: e.target.value });
                  }}
                  color={errors.name ? "danger" : "default"}
                  helperText={errors.name}
                  bordered
                  fullWidth
                />
              </div>

              <div className="col-span-12 md:col-span-10 lg:col-span-8 xl:col-span-8">
                <Input
                  label="Hostname or IP address"
                  placeholder="'yourmongodomain.com' or '0.0.0.0' "
                  value={connection.host || ""}
                  onChange={(e) => {
                    setConnection({ ...connection, host: e.target.value });
                  }}
                  color={errors.host ? "danger" : "default"}
                  description={errors.host}
                  bordered
                  fullWidth
                />
              </div>
              <div className="col-span-12 md:col-span-2 lg:col-span-4 xl:col-span-4">
                <Input
                  label="Port"
                  placeholder="Leave empty if using the default"
                  value={connection.port || ""}
                  onChange={(e) => {
                    setConnection({ ...connection, port: e.target.value });
                  }}
                  helperColor="error"
                  description={errors.port}
                  bordered
                  fullWidth
                />
              </div>

              <div className="col-span-12 md:col-span-4 lg:col-span-4 xl:col-span-4">
              
                <Input
                  label="Database name"
                  placeholder="Enter your database name"
                  value={connection.dbName || ""}
                  onChange={(e) => {
                    setConnection({ ...connection, dbName: e.target.value });
                  }}
                  color={errors.dbName ? "danger" : "default"}
                  description={errors.dbName}
                  bordered
                  fullWidth
                />
              </div>
              
              <div className="col-span-12 md:col-span-4 lg:col-span-4 xl:col-span-4">
                <Input
                  label="Database username"
                  placeholder="Username"
                  value={connection.username || ""}
                  onChange={(e) => {
                    setConnection({ ...connection, username: e.target.value });
                  }}
                  color={errors.username ? "danger" : "default"}
                  description={errors.username}
                  bordered
                  fullWidth
                />
              </div>

              <div className="col-span-12 md:col-span-4 lg:col-span-4 xl:col-span-4">
                <Input
                  type="password"
                  label="Database password"
                  placeholder="Database user password"
                  onChange={(e) => {
                    setConnection({ ...connection, password: e.target.value });
                  }}
                  color={errors.password ? "danger" : "default"}
                  description={errors.password}
                  bordered
                  fullWidth
                />
              </div>

              <div className="col-span-12">
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
              </div>

              {connection.optionsArray.length > 0 && (
                <div className="col-span-12">
                  <Text b>Connection options</Text>
                </div>
              )}
              {connection.optionsArray.map((option) => {
                return (
                  <>
                    <div className="sm:col-span-12 md:col-span-4">
                      <Input
                        placeholder="Key"
                        value={option.key}
                        onChange={(e) => _onChangeOption(option.id, e.target.value, "key")}
                        fullWidth
                      />
                    </div>
                    <div className="sm:col-span-12 md:col-span-8">
                      <Input
                        onChange={(e) => _onChangeOption(option.id, e.target.value, "value")}
                        value={option.value}
                        placeholder="Value"
                        fullWidth
                      />
                      <Spacer x={2} />
                      <Button
                        isIconOnly
                        onClick={() => _removeOption(option.id)}
                        auto
                        variant="flat"
                        color="danger"
                      >
                        <CloseSquare />
                      </Button>
                    </div>
                    <div className="md:col-span-4" />
                  </>
                );
              })}
              <div className="col-span-12">
                <Button
                  size="sm"
                  endContent={<Plus />}
                  onClick={_addOption}
                  variant="ghost"
                  auto
                >
                  Add options
                </Button>
              </div>
            </div>
          </Row>
        )}

        <Spacer y={4} />
        <Row>
          <Container className={"bg-primary-50"} size="md">
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
        <Spacer y={2} />
        <Row align="center">
          <ChevronRight set="light" />
          <Spacer x={1} />
          <Link
            target="_blank"
            rel="noopener noreferrer"
            href="https://docs.mongodb.com/manual/reference/connection-string/"
          >
            <Text>Find out more about MongoDB connection strings</Text>
          </Link>
          <Spacer x={1} />
          <FaExternalLinkSquareAlt size={12} />
        </Row>
        <Row align="center">
          <ChevronRight set="light" />
          <Spacer x={1} />
          <Link
            href="https://docs.mongodb.com/guides/cloud/connectionstring/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Text>Find out how to get your MongoDB Atlas connection string</Text>
          </Link>
          <Spacer x={1} />
          <FaExternalLinkSquareAlt size={12} />
        </Row>
        <Row align="center">
          <ChevronRight set="light" />
          <Spacer x={1} />
          <Link onClick={() => setShowIp(!showIp)}>
            <Text>Front-end and back-end on different servers?</Text>
          </Link>
        </Row>
        <Spacer y={2} />
        {showIp && (
          <Row>
            <Container className={"bg-primary-50"}>
              <Row>
                <Text b>{"You might need to whitelist the front-end IP in the back-end"}</Text>
              </Row>
              <Row>
                <Text>{"This is sometimes required when the database and the Chartbrew app are running on separate servers."}</Text>
              </Row>
            </Container>
          </Row>
        )}
        {addError && (
          <Row>
            <Container className={"bg-danger-100"}>
              <Row>
                <Text b>{"Server error while trying to save your connection"}</Text>
              </Row>
              <Row>
                <Text>Please try adding your connection again.</Text>
              </Row>
            </Container>
          </Row>
        )}
        <Spacer y={4} />
        <Row>
          <Button
            variant="ghost"
            auto
            onClick={() => _onCreateConnection(true)}
            isLoading={testLoading}
          >
            Test connection
          </Button>
          <Spacer x={1} />
          <Button
            isLoading={loading}
            onClick={_onCreateConnection}
            auto
          >
            {"Save connection"}
          </Button>
        </Row>
      </Container>

      {testLoading && (
        <>
          <Spacer y={1} />
          <Container className={"bg-content2"} size="md">
            <Row align="center">
              <CircularProgress aria-label="Loading" />
            </Row>
            <Spacer y={4} />
          </Container>
        </>
      )}

      {testResult && !testLoading && (
        <Container className={"bg-content2"} size="md">
          <Row align="center">
            <Text>
              {"Test Result "}
              <Chip
                color={testResult.status < 400 ? "success" : "danger"}
              >
                {`Status code: ${testResult.status}`}
              </Chip>
            </Text>
          </Row>
          <Spacer y={4} />
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
