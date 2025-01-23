import React, { useState, useEffect, Fragment, useRef } from "react";
import PropTypes from "prop-types";

import {
  Button, Divider, Input, Spacer,Chip, Tabs, Tab, Select, SelectItem,
} from "@heroui/react";
import { v4 as uuid } from "uuid";
import AceEditor from "react-ace";
import { useParams } from "react-router";
import { HiPlus, HiX } from "react-icons/hi";
import { useDispatch } from "react-redux";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import Row from "../../../components/Row";
import Text from "../../../components/Text";
import { useTheme } from "../../../modules/ThemeContext";
import { testRequest } from "../../../slices/connection";
import { LuEye, LuEyeOff } from "react-icons/lu";


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
  const params = useParams();

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
    return dispatch(testRequest({ team_id: params.teamId, connection: data }))
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
    <div className="p-4 bg-content1 border-1 border-solid border-content3 rounded-lg">
      <div>
        <Row align="center">
          <p className="font-semibold">
            {!editConnection && "Add a new API host"}
            {editConnection && `Edit ${editConnection.name}`}
          </p>
        </Row>
        <Spacer y={4} />
        <Row className={"gap-4"}>
          <Input
            label="Enter a name for your connection"
            placeholder="Enter a name you can recognize later"
            value={connection.name || ""}
            onChange={(e) => {
              setConnection({ ...connection, name: e.target.value });
            }}
            color={errors.name ? "danger" : "default"}
            fullWidth
            variant="bordered"
            description={errors.name}
          />

          <Input
            label="The hostname of your API"
            placeholder="https://api.example.com"
            value={connection.host || ""}
            onChange={(e) => {
              setConnection({ ...connection, host: e.target.value });
            }}
            fullWidth
            color={errors.host ? "danger" : "default"}
            variant="bordered"
            description={errors.host}
          />
        </Row>
        <Spacer y={4} />

        <Tabs selectedKey={menuType} onSelectionChange={(key) => setMenuType(key)}>
          <Tab key="authentication" title="Authentication" />
          <Tab key="headers" title="Headers" />
        </Tabs>
        <Spacer y={4} />
        <Divider />
        <Spacer y={4} />

        {menuType === "authentication" && (
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 sm:col-span-12 md:col-span-4 lg:col-span-4 xl:col-span-4">
              <Row>
                <Select
                  label="Authentication type"
                  placeholder="Select an authentication type"
                  defaultValue="no_auth"
                  selectedKeys={[connection?.authentication?.type]}
                  onSelectionChange={(keys) => _onChangeAuthParams("type", keys?.currentKey)}
                  selectionMode="single"
                  variant="bordered"
                >
                  {authTypes.map((type) => (
                    <SelectItem key={type.value} textValue={type.text}>
                      {type.text}
                    </SelectItem>
                  ))}
                </Select>
              </Row>
            </div>
            {connection.authentication && connection.authentication.type === "basic_auth" && (
              <div className="col-span-12 sm:col-span-12 md:col-span-5 lg:col-span-5 xl:col-span-5">
                <Row align="center">
                  <Input
                    label="Enter a Username or API Key"
                    placeholder="Username or API Key"
                    onChange={(e) => _onChangeAuthParams("user", e.target.value)}
                    value={connection.authentication.user}
                    fullWidth
                    variant="bordered"
                  />
                </Row>
                <Spacer y={2} />
                <Row align="center">
                  <Input
                    type={passwordVisible ? "text" : "password"}
                    label="Enter a Password or API Key Value"
                    placeholder="Password or API Key Value"
                    onChange={(e) => _onChangeAuthParams("pass", e.target.value)}
                    value={connection.authentication.pass}
                    fullWidth
                    variant="bordered"
                    endContent={(
                      <button
                        onClick={() => setPasswordVisible(!passwordVisible)}
                      >
                        {passwordVisible ? <LuEyeOff /> : <LuEye />}
                      </button>
                    )}
                  />
                </Row>
              </div>
            )}
            {connection.authentication && connection.authentication.type === "bearer_token" && (
              <div className="col-span-12 sm:col-span-12 md:col-span-5 lg:col-span-5 xl:col-span-5">
                <Input
                  type={passwordVisible ? "text" : "password"}
                  label="Enter the token"
                  placeholder="Authentication token"
                  onChange={(e) => _onChangeAuthParams("token", e.target.value)}
                  value={connection.authentication.token}
                  fullWidth
                  variant="bordered"
                  endContent={(
                    <button
                      onClick={() => setPasswordVisible(!passwordVisible)}
                    >
                      {passwordVisible ? <LuEyeOff /> : <LuEye />}
                    </button>
                  )}
                />
              </div>
            )}
          </div>
        )}
        <Spacer y={4} />

        {menuType === "headers" && (
          <>
            <Row>
              <Text b>
                Global headers to send with the requests
              </Text>
            </Row>
            <Row>
              <Text>
                {"These headers will be included with all the future requests"}
              </Text>
            </Row>
            <Spacer y={2} />
          </>
        )}

        {menuType === "headers" && connection.optionsArray && connection.optionsArray.map((option) => {
          return (
            <Fragment key={option.id}>
              <Row className={"gap-4"}>
                <Input
                  placeholder="Header name"
                  labelPlacement="outside"
                  value={option.key}
                  onChange={(e) => _onChangeOption(option.id, e.target.value, "key")}
                  fullWidth
                />
                <Input
                  onChange={(e) => _onChangeOption(option.id, e.target.value, "value")}
                  value={option.value}
                  placeholder="Value"
                  labelPlacement="outside"
                  fullWidth
                />
                <Button
                  isIconOnly
                  onClick={() => _removeOption(option.id)}
                  variant="faded"
                  color="secondary"
                >
                  <HiX />
                </Button>
              </Row>
              <Spacer y={2} />
            </Fragment>
          );
        })}

        {menuType === "headers" && (
          <>
            <Spacer y={2} />
            <Button
              endContent={<HiPlus />}
              onClick={_addOption}
              variant="bordered"
            >
              Add a header
            </Button>
            <Spacer y={4} />
          </>
        )}

        {addError && (
          <>
            <Spacer y={4} />
            <Row>
              <Text b className="text-danger">{"Server error while trying to save your connection"}</Text>
              <br />
              <Text className="text-danger">Please try adding your connection again.</Text>
            </Row>
          </>
        )}

        <Divider />
        <Spacer y={4} />
        <Row align="center">
          <Button
            variant="ghost"
            onClick={() => _onCreateConnection(true)}
            isLoading={testLoading}
            auto
          >
            {"Test connection"}
          </Button>
          <Spacer x={1} />
          {!editConnection && (
            <Button
              isLoading={loading}
              onClick={() => _onCreateConnection()}
              color="primary"
            >
              {"Save connection"}
            </Button>
          )}
          {editConnection && (
            <Button
              isLoading={loading}
              onClick={_onCreateConnection}
              color="primary"
            >
              {"Save changes"}
            </Button>
          )}
        </Row>
      </div>

      {testResult && !testLoading && (
        <>
          <Spacer y={4} />
          <Divider />
          <Spacer y={4} />
          <div>
            <Row align="center">
              <Text>
                {"Test Result "}
              </Text>
              <Spacer x={1} />
              <Chip
                size="sm"
                color={testResult.status < 400 ? "success" : "danger"}
              >
                {`Status code: ${testResult.status}`}
              </Chip>
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
