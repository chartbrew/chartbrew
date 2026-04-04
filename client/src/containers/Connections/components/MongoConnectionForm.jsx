import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Link,
  Input,
  Checkbox,
  Label,
  Tooltip,
  Button,
  Chip,
  Tabs,
  Separator,
  TextField,
  Description,
  FieldError,
  Alert,
} from "@heroui/react";

import { v4 as uuid } from "uuid";
import AceEditor from "../../../components/CodeEditor";
import { LuChevronRight, LuInfo, LuPlus, LuX } from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";

import Container from "../../../components/Container";
import { ButtonSpinner } from "../../../components/ButtonSpinner";
import Row from "../../../components/Row";
import Text from "../../../components/Text";
import { useTheme } from "../../../modules/ThemeContext";
import { testRequest } from "../../../slices/connection";
import { selectTeam } from "../../../slices/team";

/*
  The MongoDB connection form
*/
function MongoConnectionForm(props) {
  const {
    editConnection, onComplete, addError,
  } = props;

  const [showIp, setShowIp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [connection, setConnection] = useState({
    type: "mongodb", subType: "mongodb", optionsArray: [], srv: false
  });
  const [errors, setErrors] = useState({});
  const [formStyle, setFormStyle] = useState("string");
  const [testResult, setTestResult] = useState(null);

  const { isDark } = useTheme();
  const dispatch = useDispatch();
  const team = useSelector(selectTeam);

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

  const _onTestRequest = (data) => {
    const newTestResult = {};
    return dispatch(testRequest({ team_id: team.id, connection: data }))
      .then(async (response) => {
        newTestResult.status = response.payload.status;
        newTestResult.body = await response.payload.text();

        try {
          newTestResult.body = JSON.parse(newTestResult.body);
          newTestResult.body = JSON.stringify(newTestResult, null, 2);
        } catch (e) {
          // the response is not in JSON format
        }

        setTestResult(newTestResult);
        return Promise.resolve(newTestResult);
      })
      .catch(() => { });
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

    setConnection(newConnection);
    setTimeout(() => {
      if (test === true) {
        setTestLoading(true);
        _onTestRequest(newConnection)
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
    <div className="p-4 bg-surface border border-solid border-divider rounded-3xl">
      <div>
        <p className="font-semibold">
          {!editConnection && "Connect to a MongoDB database"}
          {editConnection && `Edit ${editConnection.name}`}
        </p>
        <div className="h-4" />
        <Tabs selectedKey={formStyle} onSelectionChange={(key) => setFormStyle(key)}>
          <Tabs.ListContainer>
            <Tabs.List>
              <Tabs.Tab id="string">
                <Tabs.Indicator />
                Connection string
              </Tabs.Tab>
              <Tabs.Tab id="form">
                <Tabs.Indicator />
                Connection form
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
        <div className="h-4" />
        {formStyle === "string" && (
          <>
            <Row align="center">
              <TextField fullWidth name="mongo-string-name" isInvalid={Boolean(errors.name)}>
                <Label>Name your connection</Label>
                <Input
                  placeholder="Enter a name that you can recognise later"
                  value={connection.name || ""}
                  onChange={(e) => {
                    setConnection({ ...connection, name: e.target.value });
                  }}
                  variant="secondary"
                />
                {errors.name ? <FieldError>{errors.name}</FieldError> : null}
              </TextField>
            </Row>
            <div className="h-4" />
            <Row align="center">
              <TextField fullWidth name="mongo-string-uri" isInvalid={Boolean(errors.connectionString)}>
                <Label>Enter your MongoDB connection string</Label>
                <Input
                  placeholder="mongodb://username:password@mongodb.example.com:27017/dbname"
                  value={connection.connectionString || ""}
                  onChange={(e) => {
                    setConnection({ ...connection, connectionString: e.target.value });
                  }}
                  variant="secondary"
                />
                {errors.connectionString ? (
                  <FieldError>{errors.connectionString}</FieldError>
                ) : (
                  <Description>
                    mongodb://username:password@mongodb.example.com:27017/dbname
                  </Description>
                )}
              </TextField>
            </Row>
            <div className="h-1" />
          </>
        )}

        {formStyle === "form" && (
          <Row>
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 md:col-span-8">
                <TextField fullWidth name="mongo-form-name" isInvalid={Boolean(errors.name)}>
                  <Label>Name your connection</Label>
                  <Input
                    placeholder="Enter a name that you can recognise later"
                    value={connection.name || ""}
                    onChange={(e) => {
                      setConnection({ ...connection, name: e.target.value });
                    }}
                    variant="secondary"
                  />
                  {errors.name ? <FieldError>{errors.name}</FieldError> : null}
                </TextField>
              </div>

              <div className="col-span-12 md:col-span-10">
                <TextField fullWidth name="mongo-form-host" isInvalid={Boolean(errors.host)}>
                  <Label>Hostname or IP address</Label>
                  <Input
                    placeholder="'yourmongodomain.com' or '0.0.0.0' "
                    value={connection.host || ""}
                    onChange={(e) => {
                      setConnection({ ...connection, host: e.target.value });
                    }}
                    variant="secondary"
                  />
                  {errors.host ? <FieldError>{errors.host}</FieldError> : null}
                </TextField>
              </div>
              <div className="col-span-12 md:col-span-2">
                <TextField fullWidth name="mongo-form-port" isInvalid={Boolean(errors.port)}>
                  <Label>Port</Label>
                  <Input
                    value={connection.port || ""}
                    onChange={(e) => {
                      setConnection({ ...connection, port: e.target.value });
                    }}
                    variant="secondary"
                  />
                  {errors.port ? <FieldError>{errors.port}</FieldError> : null}
                </TextField>
              </div>

              <div className="col-span-12 md:col-span-4">
                <TextField fullWidth name="mongo-form-db" isInvalid={Boolean(errors.dbName)}>
                  <Label>Database name</Label>
                  <Input
                    value={connection.dbName || ""}
                    onChange={(e) => {
                      setConnection({ ...connection, dbName: e.target.value });
                    }}
                    placeholder="Enter your database name"
                    variant="secondary"
                  />
                  {errors.dbName ? <FieldError>{errors.dbName}</FieldError> : null}
                </TextField>
              </div>
              
              <div className="col-span-12 md:col-span-4">
                <TextField fullWidth name="mongo-form-user" isInvalid={Boolean(errors.username)}>
                  <Label>Database username</Label>
                  <Input
                    value={connection.username || ""}
                    onChange={(e) => {
                      setConnection({ ...connection, username: e.target.value });
                    }}
                    placeholder="Enter your database username"
                    variant="secondary"
                  />
                  {errors.username ? <FieldError>{errors.username}</FieldError> : null}
                </TextField>
              </div>

              <div className="col-span-12 md:col-span-4">
                <TextField fullWidth name="mongo-form-pass" isInvalid={Boolean(errors.password)}>
                  <Label>Database password</Label>
                  <Input
                    type="password"
                    value={connection.password || ""}
                    onChange={(e) => {
                      setConnection({ ...connection, password: e.target.value });
                    }}
                    placeholder="Enter your database password"
                    variant="secondary"
                  />
                  {errors.password ? <FieldError>{errors.password}</FieldError> : null}
                </TextField>
              </div>

              <div className="col-span-12 flex flex-row items-center">
                <Checkbox
                  id="mongo-connection-srv"
                  isSelected={!!connection.srv}
                  onChange={(selected) => setConnection({ ...connection, srv: selected })}
                  variant="secondary"
                >
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <Checkbox.Content>
                    <Label htmlFor="mongo-connection-srv">Use MongoDB 3.6 SRV URI connection string</Label>
                  </Checkbox.Content>
                </Checkbox>
                <Tooltip delay={0}>
                  <Tooltip.Trigger>
                    <div className="ml-2"><LuInfo size={16} /></div>
                  </Tooltip.Trigger>
                  <Tooltip.Content placement="bottom" className="max-w-[400px]">
                    {"Tick this if your connection URI contains 'mongodb+srv://'"}
                  </Tooltip.Content>
                </Tooltip>
              </div>

              {connection.optionsArray.length > 0 && (
                <div className="col-span-12 mt-2">
                  <Label>Connection options</Label>
                </div>
              )}
              {connection.optionsArray.map((option) => {
                return (
                  <>
                    <div className="sm:col-span-12 md:col-span-4">
                      <TextField fullWidth aria-label="Connection option key" name={`mongo-opt-key-${option.id}`}>
                        <Input
                          placeholder="Key"
                          value={option.key}
                          onChange={(e) => _onChangeOption(option.id, e.target.value, "key")}
                          variant="secondary"
                        />
                      </TextField>
                    </div>
                    <div className="sm:col-span-12 md:col-span-8 flex flex-row items-center gap-2">
                      <TextField fullWidth aria-label="Connection option value" name={`mongo-opt-val-${option.id}`}>
                        <Input
                          onChange={(e) => _onChangeOption(option.id, e.target.value, "value")}
                          value={option.value}
                          placeholder="Value"
                          variant="secondary"
                        />
                      </TextField>
                      <Button
                        isIconOnly
                        onClick={() => _removeOption(option.id)}
                        variant="ghost"
                      >
                        <LuX size={16} />
                      </Button>
                    </div>
                  </>
                );
              })}
              <div className="col-span-12">
                <Button
                  size="sm"
                  onClick={_addOption}
                  variant="tertiary"
                >
                  Add options
                  <LuPlus />
                </Button>
              </div>
            </div>
          </Row>
        )}

        <div className="h-4" />
        <Separator />
        <div className="h-4" />
        <Alert status="warning" className="shadow-none border border-divider">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Avoid using credentials that can write data</Alert.Title>
            <Alert.Description className="block text-sm">
              Out of abundance of caution, we recommend all our users to connect only with read permissions. Don&apos;t use mongo users with readWrite permissions.
            </Alert.Description>
            <div className="mt-2">
              <Link href="https://docs.mongodb.com/manual/reference/method/db.createUser/" target="_blank" rel="noopener noreferrer">
                Check this link on how to do it
              </Link>
            </div>
          </Alert.Content>
        </Alert>
        <div className="h-4" />
        <div className="flex flex-col gap-2">
          <Row align="center">
            <LuChevronRight size={16} />
            <div className="w-2" />
            <Link
              target="_blank"
              rel="noopener noreferrer"
              href="https://docs.mongodb.com/manual/reference/connection-string/"
              className="text-foreground/70!"
            >
              Find out more about MongoDB connection strings
              <Link.Icon />
            </Link>
            <div className="w-2" />
            
          </Row>
          <Row align="center">
            <LuChevronRight size={16} />
            <div className="w-2" />
            <Link
              href="https://docs.mongodb.com/guides/cloud/connectionstring/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground/70!"
            >
              Find out how to get your MongoDB Atlas connection string
              <Link.Icon />
            </Link>
          </Row>
          <Row align="center">
            <LuChevronRight size={16} />
            <div className="w-2" />
            <Link onPress={() => setShowIp(!showIp)} className="text-foreground/70!">
              Front-end and back-end on different servers?
            </Link>
          </Row>
        </div>
        <div className="h-4" />
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
        <div className="h-8" />
        <Row>
          <Button
            variant="outline"
            auto
            onClick={() => _onCreateConnection(true)}
            isPending={testLoading}
          >
            {testLoading ? <ButtonSpinner /> : null}
            Test connection
          </Button>
          <div className="w-2" />
          <Button
            isPending={loading}
            onClick={_onCreateConnection}
            color="primary"
          >
            {loading ? <ButtonSpinner /> : null}
            {"Save connection"}
          </Button>
        </Row>
      </div>

      {testResult && !testLoading && (
        <>
          <div className="h-4" />
          <Separator />
          <div className="h-4" />
          <div>
            <Row align="center">
              <Text>
                {"Test Result "}
              </Text>
              <div className="w-4" />
              <Chip
                color={testResult.status < 400 ? "success" : "danger"}
                size="sm"
                variant="soft"
              >
                {`Status code: ${testResult.status}`}
              </Chip>
            </Row>
            <div className="h-4" />
            <AceEditor
              mode="json"
              theme={isDark ? "one_dark" : "tomorrow"}
              style={{ borderRadius: 10 }}
              width="none"
              value={testResult.body || "Hello"}
              readOnly
              name="queryEditor"
              editorProps={{ $blockScrolling: true }}
            />
          </div>
        </>
      )}
    </div>
  );
}

MongoConnectionForm.defaultProps = {
  onComplete: () => {},
  editConnection: null,
  addError: false,
};

MongoConnectionForm.propTypes = {
  onComplete: PropTypes.func,
  editConnection: PropTypes.object,
  addError: PropTypes.bool,
};

export default MongoConnectionForm;
