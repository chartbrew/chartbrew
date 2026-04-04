import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import {
  Button, Input, Chip, Separator, Switch, Select,
  ProgressCircle, Label, ListBox,
  TextField, Description, FieldError,
} from "@heroui/react";
import { LuChevronRight, LuCircleCheck, LuUpload } from "react-icons/lu";
import AceEditor from "../../../components/CodeEditor";
import { useDispatch, useSelector } from "react-redux";

import Text from "../../../components/Text";
import Container from "../../../components/Container";
import { ButtonSpinner } from "../../../components/ButtonSpinner";
import Row from "../../../components/Row";
import { useTheme } from "../../../modules/ThemeContext";
import { testRequest, testRequestWithFiles } from "../../../slices/connection";
import { selectTeam } from "../../../slices/team";

function ClickHouseConnectionForm(props) {
  const {
    editConnection = null, onComplete = () => {}, addError = false,
  } = props;

  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [connection, setConnection] = useState({
    type: "clickhouse", subType: "clickhouse", sslMode: "require", ssl: true,
  });
  const [errors, setErrors] = useState({});
  const [testResult, setTestResult] = useState(null);
  const [sslCerts, setSslCerts] = useState({
    sslCa: null,
    sslCert: null,
    sslKey: null,
  });
  const [sslCertsErrors, setSslCertsErrors] = useState({
    sslCa: null,
    sslCert: null,
    sslKey: null,
  });

  const { isDark } = useTheme();
  const dispatch = useDispatch();
  const team = useSelector(selectTeam);
  const initRef = useRef(null);

  useEffect(() => {
    if (editConnection?.id && !initRef.current) {
      initRef.current = true;
      _init();
    }
  }, [editConnection]);

  const _init = () => {
    const newConnection = { ...editConnection };
    setConnection({ ...newConnection });
  };

  const _onTestRequest = async (data) => {
    const newTestResult = {};
    let response;
    
    const files = {
      ...sslCerts
    };
    
    if ((data.ssl && sslCerts.sslCa)) {
      response = await dispatch(testRequestWithFiles({
        team_id: team?.id,
        connection: data,
        files
      }));
    } else {
      response = await dispatch(testRequest({ team_id: team?.id, connection: data }));
    }

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

    const newConnection = connection;
    newConnection.host = newConnection.host.replace("https://", "").replace("http://", "");
    
    setConnection(newConnection);
    setTimeout(() => {
      if (test === true) {
        setTestLoading(true);
        _onTestRequest(newConnection)
          .then(() => setTestLoading(false))
          .catch(() => setTestLoading(false));
      } else {
        setLoading(true);
        
        const files = {
          ...sslCerts
        };
        
        onComplete(newConnection, files)
          .then(() => setLoading(false))
          .catch(() => setLoading(false));
      }
    }, 100);
  };

  const isValidExtension = (fileName, validExtensions = [".crt", ".key", ".pem"]) => {
    return validExtensions.some(extension => fileName.toLowerCase().endsWith(extension));
  };

  const isValidFileSize = (file, maxSizeInBytes = 8192) => { // 8KB max size
    return file.size <= maxSizeInBytes;
  };

  const _selectRootCert = (e) => {
    const file = e.target.files[0];
    if (!isValidExtension(file.name)) {
      setSslCertsErrors({ ...sslCertsErrors, sslCa: "Invalid file type. Try .crt or .pem" });
      return;
    }
    if (!isValidFileSize(file)) {
      setSslCertsErrors({ ...sslCertsErrors, sslCa: "File size is too large. Max size is 8KB" });
      return;
    }

    setSslCerts({ ...sslCerts, sslCa: file });
  };

  const _selectClientCert = (e) => {
    const file = e.target.files[0];
    if (!isValidExtension(file.name)) {
      setSslCertsErrors({ ...sslCertsErrors, sslCert: "Invalid file type. Try .crt or .pem" });
      return;
    }
    if (!isValidFileSize(file)) {
      setSslCertsErrors({ ...sslCertsErrors, sslCert: "File size is too large. Max size is 8KB" });
      return;
    }
    setSslCerts({ ...sslCerts, sslCert: file });
  };

  const _selectClientKey = (e) => {
    const file = e.target.files[0];
    if (!isValidExtension(file.name)) {
      setSslCertsErrors({ ...sslCertsErrors, sslKey: "Invalid file type. Try .key" });
      return;
    }
    if (!isValidFileSize(file)) {
      setSslCertsErrors({ ...sslCertsErrors, sslKey: "File size is too large. Max size is 8KB" });
      return;
    }
    setSslCerts({ ...sslCerts, sslKey: file });
  };

  const _onChangeSSL = (checked) => {
    if (checked && !connection.sslMode) {
      setConnection({ ...connection, ssl: checked, sslMode: "require" });
    } else {
      setConnection({ ...connection, ssl: checked });
    }
  };

  if (editConnection && !connection.id) {
    return <ProgressCircle aria-label="Loading connection" />;
  }

  return (
    <div className="p-4 bg-surface border border-divider rounded-3xl pb-10">
      <div>
        <p className="font-semibold">
          {!editConnection && "Add a new ClickHouse connection"}
          {editConnection && `Edit ${editConnection.name}`}
        </p>
        <div className="h-8" />

        <div className="flex flex-col gap-2">
          <TextField className="max-w-md" fullWidth name="ch-name" isInvalid={Boolean(errors.name)}>
            <Label>Name your connection</Label>
            <Input
              variant="secondary"
              placeholder="Enter a name that you can recognise later"
              value={connection.name || ""}
              onChange={(e) => {
                setConnection({ ...connection, name: e.target.value });
              }}
            />
            {errors.name ? <FieldError>{errors.name}</FieldError> : null}
          </TextField>

          <TextField className="max-w-md" fullWidth name="ch-host" isInvalid={Boolean(errors.host)}>
            <Label>Hostname or IP address</Label>
            <Input
              variant="secondary"
              placeholder="clickhouse.example.com"
              value={connection.host || ""}
              onChange={(e) => {
                setConnection({ ...connection, host: e.target.value });
              }}
            />
            {errors.host ? <FieldError>{errors.host}</FieldError> : null}
          </TextField>

          <TextField className="max-w-md" fullWidth name="ch-port" isInvalid={Boolean(errors.port)}>
            <Label>Port</Label>
            <Input
              variant="secondary"
              placeholder={connection.ssl ? "8443" : "8123"}
              value={connection.port || ""}
              onChange={(e) => {
                setConnection({ ...connection, port: e.target.value });
              }}
            />
            {errors.port ? (
              <FieldError>{errors.port}</FieldError>
            ) : (
              <Description>
                {connection.ssl ? "Default HTTPS port: 8443" : "Default HTTP port: 8123"}
              </Description>
            )}
          </TextField>

          <TextField className="max-w-md" fullWidth name="ch-db" isInvalid={Boolean(errors.dbName)}>
            <Label>Database name</Label>
            <Input
              placeholder="Enter your database name"
              variant="secondary"
              value={connection.dbName || ""}
              onChange={(e) => {
                setConnection({ ...connection, dbName: e.target.value });
              }}
            />
            {errors.dbName ? <FieldError>{errors.dbName}</FieldError> : null}
          </TextField>

          <TextField className="max-w-md" fullWidth name="ch-user" isInvalid={Boolean(errors.username)}>
            <Label>Database username</Label>
            <Input
              placeholder="Enter your database username"
              variant="secondary"
              value={connection.username || ""}
              onChange={(e) => {
                setConnection({ ...connection, username: e.target.value });
              }}
            />
            {errors.username ? <FieldError>{errors.username}</FieldError> : null}
          </TextField>

          <TextField className="max-w-md" fullWidth name="ch-pass" isInvalid={Boolean(errors.password)}>
            <Label>Database password</Label>
            <Input
              type="password"
              placeholder="Enter your database password"
              variant="secondary"
              value={connection.password || ""}
              onChange={(e) => {
                setConnection({ ...connection, password: e.target.value });
              }}
            />
            {errors.password ? <FieldError>{errors.password}</FieldError> : null}
          </TextField>
        </div>

        <div className="h-8" />
        <div className="flex items-center gap-2">
          <Switch
            id="clickhouse-connection-ssl"
            isSelected={connection.ssl || false}
            onChange={(selected) => _onChangeSSL(selected)}
          >
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <Switch.Content>
              <Label htmlFor="clickhouse-connection-ssl">{"Enable SSL"}</Label>
            </Switch.Content>
          </Switch>
        </div>
        {connection.ssl && (
          <>
            <div className="h-4" />
            <div className="flex items-center gap-2">
              <Select
                variant="secondary"
                value={connection.sslMode || null}
                onChange={(value) => {
                  setConnection({ ...connection, sslMode: value });
                }}
                className="w-full md:w-1/2 lg:w-1/3"
                size="sm"
                selectionMode="single"
                disallowEmptySelection
              >
                <Label>SSL Mode</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="require" textValue="Require">
                      {"Require"}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id="disable" textValue="Disable">
                      {"Disable"}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id="prefer" textValue="Prefer">
                      {"Prefer"}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id="verify-ca" textValue="Verify CA">
                      {"Verify CA"}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id="verify-full" textValue="Verify Full">
                      {"Verify Full"}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>

            {(connection.sslMode === "verify-full" || connection.sslMode === "verify-ca") && (
              <>
                <div className="h-4" />
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    id="rootCertInput"
                    style={{ display: "none" }}
                    onChange={_selectRootCert}
                  />
                  <Button
                    variant="tertiary"
                    onPress={() => document.getElementById("rootCertInput").click()}
                  >
                    <LuUpload />
                    {"Certificate authority"}
                  </Button>
                  <div className="w-4" />
                  {sslCerts.sslCa && (
                    <span className="text-sm">{sslCerts.sslCa.name}</span>
                  )}
                  {sslCertsErrors.sslCa && (
                    <span className="text-sm text-danger">
                      {sslCertsErrors.sslCa}
                    </span>
                  )}
                  {!sslCertsErrors.sslCa && connection.sslCa && (
                    <LuCircleCheck className="text-success" size={20} />
                  )}
                </div>
                <div className="h-4" />
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    id="clientCertInput"
                    style={{ display: "none" }}
                    onChange={_selectClientCert}
                  />
                  <Button
                    variant="tertiary"
                    onPress={() => document.getElementById("clientCertInput").click()}
                  >
                    <LuUpload />
                    {"SSL certificate"}
                  </Button>
                  <div className="w-4" />
                  {sslCerts.sslCert && (
                    <span className="text-sm">{sslCerts.sslCert.name}</span>
                  )}
                  {sslCertsErrors.sslCert && (
                    <span className="text-sm text-danger">
                      {sslCertsErrors.sslCert}
                    </span>
                  )}
                  {!sslCertsErrors.sslCert && connection.sslCert && (
                    <LuCircleCheck className="text-success" size={20} />
                  )}
                </div>
                <div className="h-4" />
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    id="clientKeyInput"
                    style={{ display: "none" }}
                    onChange={_selectClientKey}
                  />
                  <Button
                    variant="tertiary"
                    onPress={() => document.getElementById("clientKeyInput").click()}
                  >
                    <LuUpload />
                    {"SSL key"}
                  </Button>
                  <div className="w-4" />
                  {sslCerts.sslKey && (
                    <span className="text-sm">{sslCerts.sslKey.name}</span>
                  )}
                  {sslCertsErrors.sslKey && (
                    <span className="text-sm text-danger">
                      {sslCertsErrors.sslKey}
                    </span>
                  )}
                  {!sslCertsErrors.sslKey && connection.sslKey && (
                    <LuCircleCheck className="text-success" size={20} />
                  )}
                </div>
                <div className="h-4" />
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    {"Certificates are accepted in .crt, .pem, and .key formats"}
                  </span>
                </div>
              </>
            )}
          </>
        )}

        <div className="h-4" />
        <FormGuides />

        {addError && (
          <Row>
            <Container className={"bg-danger-100 p-10"}>
              <Row>
                <Text h5>{"Server error while trying to save your connection"}</Text>
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
            onPress={() => _onCreateConnection(true)}
            isPending={testLoading}
          >
            {testLoading ? <ButtonSpinner /> : null}
            {"Test connection"}
          </Button>
          <div className="w-2" />
          <Button
            variant="primary"
            isPending={loading}
            onPress={_onCreateConnection}
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
              <div className="font-bold text-sm">
                {"Test Result "}
              </div>
              <div className="w-4" />
              <Chip size="sm"
                variant="soft"
                className="rounded-sm"
              >
                {`Status code: ${testResult.status}`}
              </Chip>
            </Row>
            <div className="h-2" />
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

function FormGuides() {
  return (
    <>
      <Row align="center">
        <LuChevronRight size={16} />
        <div className="w-2" />
        <div>
          {"You might need to whitelist your server's IP address to allow remote connections"}
        </div>
      </Row>
    </>
  );
}

ClickHouseConnectionForm.propTypes = {
  onComplete: PropTypes.func,
  editConnection: PropTypes.object,
  addError: PropTypes.bool,
};

export default ClickHouseConnectionForm;
