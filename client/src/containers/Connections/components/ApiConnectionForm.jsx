import React, { useState, useEffect, Fragment, useRef } from "react";
import PropTypes from "prop-types";

import {
  Alert,
  Button,
  Chip,
  Description,
  FieldError,
  Input,
  InputGroup,
  Label,
  ListBox,
  Separator,
  Select,
  Tabs,
  TextField,
} from "@heroui/react";
import { v4 as uuid } from "uuid";
import AceEditor from "../../../components/CodeEditor";
import { useDispatch, useSelector } from "react-redux";
import { LuEye, LuEyeOff, LuPlus, LuX } from "react-icons/lu";

import Row from "../../../components/Row";
import { ButtonSpinner } from "../../../components/ButtonSpinner";
import Text from "../../../components/Text";
import { useTheme } from "../../../modules/ThemeContext";
import { testRequest } from "../../../slices/connection";
import { selectTeam } from "../../../slices/team";


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
    editConnection, onComplete, addError,
  } = props;

  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [connection, setConnection] = useState({
    type: "api", subType: "api", optionsArray: []
  });
  const [errors, setErrors] = useState({});
  const [menuType, setMenuType] = useState("authentication");
  const [testResult, setTestResult] = useState(null);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const { isDark } = useTheme();
  const initRef = useRef(null);
  const dispatch = useDispatch();
  const team = useSelector(selectTeam);

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      _addOption();
      _init();
    }
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
    const newConnection = { ...connection, options: newOptions };
    setConnection(newConnection);

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
    <div className="p-4 bg-surface border border-divider rounded-3xl pb-10">
      <div>
        <div className="flex items-center">
          <p className="font-semibold">
            {!editConnection && "Add a new API host"}
            {editConnection && `Edit ${editConnection.name}`}
          </p>
        </div>
        <div className="h-4" />
        <div className="flex items-center">
          <TextField
            fullWidth
            className="max-w-md"
            name="api-connection-name"
            isInvalid={Boolean(errors.name)}
          >
            <Label>Enter a name for your connection</Label>
            <Input
              placeholder="Enter a name you can recognize later"
              value={connection.name || ""}
              onChange={(e) => setConnection({ ...connection, name: e.target.value })}
              variant="secondary"
            />
            {errors.name ? <FieldError>{errors.name}</FieldError> : null}
          </TextField>
        </div>
        <div className="h-2" />
        <div className="flex items-center">
          <TextField
            fullWidth
            className="max-w-md"
            name="api-connection-host"
            isInvalid={Boolean(errors.host)}
          >
            <Label>The hostname of your API</Label>
            <Input
              placeholder="https://api.example.com"
              value={connection.host || ""}
              onChange={(e) => setConnection({ ...connection, host: e.target.value })}
              variant="secondary"
            />
            {errors.host ? (
              <FieldError>{errors.host}</FieldError>
            ) : (
              <Description>
                This should be the base URL of your API. Datasets can be configured for each endpoint.
              </Description>
            )}
          </TextField>
        </div>
        <div className="h-4" />
        <Separator />
        <div className="h-4" />

        <div>
          <Tabs selectedKey={menuType} onSelectionChange={(key) => setMenuType(key)} className="max-w-lg">
            <Tabs.ListContainer>
              <Tabs.List>
                <Tabs.Tab id="authentication">
                  Authentication
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="headers">
                  Headers
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
        </div>

        <div className="h-4" />

        {menuType === "authentication" && (
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 sm:col-span-12 md:col-span-4 lg:col-span-4 xl:col-span-4">
              <Select
                placeholder="Select an authentication type"
                value={connection?.authentication?.type || null}
                onChange={(value) => _onChangeAuthParams("type", value)}
                selectionMode="single"
                variant="secondary"
              >
                <Label>Authentication type</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {authTypes.map((type) => (
                      <ListBox.Item key={type.value} id={type.value} textValue={type.text}>
                        {type.text}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
            {connection.authentication && connection.authentication.type === "basic_auth" && (
              <div className="col-span-12 sm:col-span-12 md:col-span-5 lg:col-span-5 xl:col-span-5">
                <Row align="center">
                  <TextField fullWidth className="w-full" name="api-auth-user">
                    <Label>Enter a Username or API Key</Label>
                    <Input
                      placeholder="Username or API Key"
                      onChange={(e) => _onChangeAuthParams("user", e.target.value)}
                      value={connection.authentication.user}
                      fullWidth
                      variant="secondary"
                    />
                  </TextField>
                </Row>
                <div className="h-4" />
                <Row align="center">
                  <TextField fullWidth className="w-full" name="api-auth-pass">
                    <Label>Enter a Password or API Key Value</Label>
                    <InputGroup fullWidth variant="secondary">
                      <InputGroup.Input
                        type={passwordVisible ? "text" : "password"}
                        placeholder="Password or API Key Value"
                        onChange={(e) => _onChangeAuthParams("pass", e.target.value)}
                        value={connection.authentication.pass}
                      />
                      <InputGroup.Suffix className="pr-2 border-none">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="ghost"
                          aria-label={passwordVisible ? "Hide password" : "Show password"}
                          onPress={() => setPasswordVisible(!passwordVisible)}
                        >
                          {passwordVisible ? <LuEyeOff /> : <LuEye />}
                        </Button>
                      </InputGroup.Suffix>
                    </InputGroup>
                  </TextField>
                </Row>
              </div>
            )}
            {connection.authentication && connection.authentication.type === "bearer_token" && (
              <div className="col-span-12 sm:col-span-12 md:col-span-5 lg:col-span-5 xl:col-span-5">
                <TextField fullWidth className="w-full" name="api-bearer-token">
                  <Label>Enter the token</Label>
                  <InputGroup fullWidth variant="secondary">
                    <InputGroup.Input
                      type={passwordVisible ? "text" : "password"}
                      placeholder="Authentication token"
                      onChange={(e) => _onChangeAuthParams("token", e.target.value)}
                      value={connection.authentication.token}
                    />
                    <InputGroup.Suffix className="pr-0">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        aria-label={passwordVisible ? "Hide token" : "Show token"}
                        onPress={() => setPasswordVisible(!passwordVisible)}
                      >
                        {passwordVisible ? <LuEyeOff /> : <LuEye />}
                      </Button>
                    </InputGroup.Suffix>
                  </InputGroup>
                </TextField>
              </div>
            )}
          </div>
        )}
        <div className="h-4" />

        {menuType === "headers" && (
          <>
            <p className="font-semibold">Global headers to send with the requests</p>
            <p className="text-sm text-foreground-500">These headers will be included with all the future requests</p>
            <div className="h-4" />
          </>
        )}

        {menuType === "headers" && connection.optionsArray && connection.optionsArray.map((option) => {
          return (
            <Fragment key={option.id}>
              <div className="flex items-center gap-2 sm:flex-wrap md:flex-nowrap">
                <Input
                  placeholder="Header name"
                  labelPlacement="outside"
                  value={option.key}
                  onChange={(e) => _onChangeOption(option.id, e.target.value, "key")}
                  fullWidth
                  className="max-w-md"
                  variant="secondary"
                />
                <Input
                  onChange={(e) => _onChangeOption(option.id, e.target.value, "value")}
                  value={option.value}
                  placeholder="Value"
                  labelPlacement="outside"
                  fullWidth
                  className="max-w-md"
                  variant="secondary"
                />
                <Button
                  isIconOnly
                  onPress={() => _removeOption(option.id)}
                  variant="ghost"
                  className="min-w-10"
                >
                  <LuX />
                </Button>
              </div>
              <div className="h-2" />
            </Fragment>
          );
        })}

        {menuType === "headers" && (
          <>
            <div className="h-4" />
            <Button
              onPress={_addOption}
              variant="tertiary"
              size="sm"
            >
              Add header
              <LuPlus size={16} />
            </Button>
            <div className="h-8" />
          </>
        )}

        {addError && (
          <>
            <div className="h-8" />
            <Row>
              <Text b className="text-danger">{"Server error while trying to save your connection"}</Text>
              <br />
              <Text className="text-danger">Please try adding your connection again.</Text>
            </Row>
          </>
        )}

        <Separator />
        <div className="h-4" />
        <Row align="center">
          <Button
            variant="outline"
            onPress={() => _onCreateConnection(true)}
            isPending={testLoading}
          >
            {testLoading ? <ButtonSpinner /> : null}
            {"Test connection"}
          </Button>
          <div className="w-2" />
          {!editConnection && (
            <Button
              isPending={loading}
              onPress={() => _onCreateConnection()}
              variant="primary"
            >
              {loading ? <ButtonSpinner /> : null}
              {"Save connection"}
            </Button>
          )}
          {editConnection && (
            <Button
              isPending={loading}
              onPress={_onCreateConnection}
              variant="primary"
            >
              {loading ? <ButtonSpinner /> : null}
              {"Save changes"}
            </Button>
          )}
        </Row>
      </div>

      {testResult && !testLoading && (
        <>
          <div className="h-4" />
          <Separator />
          <div className="h-4" />
          <div>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">
                {"Test Result "}
              </div>
              <div>
                <Chip
                  size="sm"
                  color={testResult.status < 400 ? "success" : "danger"}
                  variant="soft"
                >
                  {`Status code: ${testResult.status}`}
                </Chip>
              </div>
            </div>
            {testResult.status >= 400 && (
              <>
                <div className="h-4" />
                <Alert status="accent">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>Connection info</Alert.Title>
                    <Alert.Description>
                      Making API requests to base URLs can sometimes fail, but it&apos;s not always an issue. Lots of APIs fail to return data when the base URL is used directly. You can configure datasets to make requests to the correct endpoints after the connection is saved.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              </>
            )}
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
            <div className="h-4" />
          </div>
        </>
      )}
    </div>
  );
}

ApiConnectionForm.defaultProps = {
  editConnection: null,
  addError: null,
};

ApiConnectionForm.propTypes = {
  onComplete: PropTypes.func.isRequired,
  editConnection: PropTypes.object,
  addError: PropTypes.bool,
};

export default ApiConnectionForm;
