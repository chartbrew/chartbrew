import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Button, Input,
  TextField, Label, FieldError,
} from "@heroui/react";
import { v4 as uuid } from "uuid";
import { LuCirclePlus, LuX } from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import Row from "../../../components/Row";
import { ButtonSpinner } from "../../../components/ButtonSpinner";
import Text from "../../../components/Text";
import { testRequest } from "../../../slices/connection";
import { selectTeam } from "../../../slices/team";

/*
  The Form used to create a Strapi API connection
*/
function StrapiConnectionForm(props) {
  const {
    editConnection, onComplete, addError,
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
  const [testResult, setTestResult] = useState(null); // eslint-disable-line

  const dispatch = useDispatch();
  const team = useSelector(selectTeam);

  useEffect(() => {
    _init();
  }, []);

  const _onTestRequest = (data) => {
    const newTestResult = {};
    return dispatch(testRequest({ team_id: team?.id, connection: data }))
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

    setTimeout(() => {
      const newConnection = connection;
      newConnection.options = newOptions;
      if (test === true) {
        _onTestRequest(newConnection);
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
    <div className="p-4 bg-surface border border-divider rounded-3xl pb-10">
      <div>
        <p className="font-semibold">
          {!editConnection && "Connect to Strapi"}
          {editConnection && `Edit ${editConnection.name}`}
        </p>
        <div style={styles.formStyle}>
          <Row>
            <TextField fullWidth className="max-w-[500px]" name="strapi-name" isInvalid={Boolean(errors.name)}>
              <Label>Enter a name for your connection</Label>
              <Input
                placeholder="Enter a name you can recognize later"
                value={connection.name || ""}
                onChange={(e) => {
                  setConnection({ ...connection, name: e.target.value });
                }}
                variant="secondary"
              />
              {errors.name ? <FieldError>{errors.name}</FieldError> : null}
            </TextField>
          </Row>

          <div className="h-2" />
          <Row>
            <TextField fullWidth className="max-w-[500px]" name="strapi-host" isInvalid={Boolean(errors.host)}>
              <Label>Strapi API URL</Label>
              <Input
                placeholder="https://yourstrapi.com/api"
                value={connection.host || ""}
                onChange={(e) => {
                  setConnection({ ...connection, host: e.target.value });
                }}
                variant="secondary"
              />
              {errors.host ? <FieldError>{errors.host}</FieldError> : null}
            </TextField>
          </Row>

          <div className="h-4" />
          <Row>
            <TextField fullWidth className="max-w-[500px]" name="strapi-token" isInvalid={Boolean(errors.authentication)}>
              <Label>Strapi API token</Label>
              <Input
                placeholder="Enter the API token"
                value={connection?.authentication?.token || ""}
                onChange={(e) => _onChangeAuthParams("token", e.target.value)}
                variant="secondary"
              />
              {errors.authentication ? <FieldError>{errors.authentication}</FieldError> : null}
            </TextField>
          </Row>

          <div className="h-4" />
          <div className="text-sm font-bold">
            Global headers to send with the requests
          </div>
          <div className="text-sm">
            {"These headers are optional and will be included with all the data requests that go to Strapi"}
          </div>
          <div className="h-2" />
          <div className="flex flex-col gap-2">
            {connection.optionsArray && connection.optionsArray.map((option) => {
              return (
                <Row key={option.id} className={"gap-2"}>
                  <TextField fullWidth aria-label="Header name" name={`strapi-hdr-key-${option.id}`}>
                    <Input
                      placeholder="Header name"
                      value={option.key}
                      onChange={(e) => _onChangeOption(option.id, e.target.value, "key")}
                      variant="secondary"
                    />
                  </TextField>
                  <TextField fullWidth aria-label="Header value" name={`strapi-hdr-val-${option.id}`}>
                    <Input
                      onChange={(e) => _onChangeOption(option.id, e.target.value, "value")}
                      value={option.value}
                      placeholder="Value"
                      variant="secondary"
                    />
                  </TextField>
                  <Button
                    isIconOnly
                    onPress={() => _removeOption(option.id)}
                    variant="ghost"
                  >
                    <LuX />
                  </Button>
                </Row>
              );
            })}
          </div>
          {connection.optionsArray?.length > 0 && (<div className="h-2" />)}
          <Button
            size="sm"
            onPress={_addOption}
            variant="tertiary"
          >
            <LuCirclePlus />
            Add a header
          </Button>
        </div>

        {addError && (
          <>
            <div className="h-4" />
            <Row>
              <Text b color="danger">{"Server error while trying to save your connection"}</Text>
              <br />
              <Text color="danger">Please try adding your connection again.</Text>
            </Row>
          </>
        )}

        <div className="h-4" />
        <Row align="center">
          {!editConnection && (
            <Button
              isPending={loading}
              onPress={_onCreateConnection}
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
              {"Save connection"}
            </Button>
          )}
        </Row>
      </div>
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
  editConnection: PropTypes.object,
  addError: PropTypes.bool,
};

export default StrapiConnectionForm;
