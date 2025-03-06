import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import {
  Button, Input, Spacer, Chip, Divider, Switch, Select, SelectItem,
  CircularProgress,
} from "@heroui/react";
import { LuCircleCheck, LuCopy, LuCopyCheck, LuUpload } from "react-icons/lu";
import AceEditor from "react-ace";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import Text from "../../../components/Text";
import Container from "../../../components/Container";
import Row from "../../../components/Row";
import { useTheme } from "../../../modules/ThemeContext";
import { RiArrowRightSLine } from "react-icons/ri";
import { useDispatch } from "react-redux";
import { useParams } from "react-router";
import { testRequest, testRequestWithFiles } from "../../../slices/connection";

function ClickHouseConnectionForm(props) {
  const {
    editConnection, onComplete, addError,
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
  const params = useParams();
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
        team_id: params.teamId,
        connection: data,
        files
      }));
    } else {
      response = await dispatch(testRequest({ team_id: params.teamId, connection: data }));
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
    return <CircularProgress aria-label="Loading connection" />;
  }

  return (
    <div className="p-4 bg-content1 border-1 border-solid border-content3 rounded-lg">
      <div>
        <p className="font-semibold">
          {!editConnection && "Add a new ClickHouse connection"}
          {editConnection && `Edit ${editConnection.name}`}
        </p>
        <Spacer y={4} />

        <div className="flex flex-col gap-2">
          <Input
            label="Name your connection"
            placeholder="Enter a name that you can recognise later"
            value={connection.name || ""}
            onChange={(e) => {
              setConnection({ ...connection, name: e.target.value });
            }}
            color={errors.name ? "danger" : "default"}
            description={errors.name}
            variant="bordered"
            className="max-w-md"
          />

          <Input
            label="Hostname or IP address"
            placeholder="clickhouse.example.com"
            value={connection.host || ""}
            onChange={(e) => {
              setConnection({ ...connection, host: e.target.value });
            }}
            color={errors.host ? "danger" : "default"}
            description={errors.host}
            variant="bordered"
            className="max-w-md"
          />

          <Input
            label="Port"
            placeholder={connection.ssl ? "8443" : "8123"}
            value={connection.port || ""}
            onChange={(e) => {
              setConnection({ ...connection, port: e.target.value });
            }}
            color={errors.port ? "danger" : "default"}
            description={connection.ssl ? "Default HTTPS port: 8443" : "Default HTTP port: 8123"}
            variant="bordered"
            className="max-w-md"
          />

          <Input
            label="Database name"
            value={connection.dbName || ""}
            onChange={(e) => {
              setConnection({ ...connection, dbName: e.target.value });
            }}
            color={errors.dbName ? "danger" : "default"}
            description={errors.dbName}
            variant="bordered"
            className="max-w-md"
          />

          <Input
            label="Database username"
            value={connection.username || ""}
            onChange={(e) => {
              setConnection({ ...connection, username: e.target.value });
            }}
            color={errors.username ? "danger" : "default"}
            description={errors.username}
            variant="bordered"
            className="max-w-md"
          />

          <Input
            type="password"
            label="Database password"
            value={connection.password || ""}
            onChange={(e) => {
              setConnection({ ...connection, password: e.target.value });
            }}
            color={errors.password ? "danger" : "default"}
            description={errors.password}
            variant="bordered"
            className="max-w-md"
          />
        </div>

        <Spacer y={4} />
        <div className="flex items-center gap-2">
          <Switch
            label="SSL"
            isSelected={connection.ssl || false}
            checked={connection.ssl || false}
            onChange={(e) => _onChangeSSL(e.target.checked)}
            size="sm"
          >
            {"Enable SSL"}
          </Switch>
        </div>
        {connection.ssl && (
          <>
            <Spacer y={2} />
            <div className="flex items-center gap-2">
              <Select
                variant="bordered"
                label="SSL Mode"
                selectedKeys={[connection.sslMode]}
                onSelectionChange={(keys) => {
                  setConnection({ ...connection, sslMode: keys.currentKey });
                }}
                className="w-full md:w-1/2 lg:w-1/3"
                size="sm"
                selectionMode="single"
                disallowEmptySelection
              >
                <SelectItem key="require" textValue="Require">{"Require"}</SelectItem>
                <SelectItem key="disable" textValue="Disable">{"Disable"}</SelectItem>
                <SelectItem key="prefer" textValue="Prefer">{"Prefer"}</SelectItem>
                <SelectItem key="verify-ca" textValue="Verify CA">{"Verify CA"}</SelectItem>
                <SelectItem key="verify-full" textValue="Verify Full">{"Verify Full"}</SelectItem>
              </Select>
            </div>

            {(connection.sslMode === "verify-full" || connection.sslMode === "verify-ca") && (
              <>
                <Spacer y={2} />
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    id="rootCertInput"
                    style={{ display: "none" }}
                    onChange={_selectRootCert}
                  />
                  <Button
                    variant="ghost"
                    startContent={<LuUpload />}
                    onPress={() => document.getElementById("rootCertInput").click()}
                  >
                    {"Certificate authority"}
                  </Button>
                  <Spacer x={2} />
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
                <Spacer y={2} />
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    id="clientCertInput"
                    style={{ display: "none" }}
                    onChange={_selectClientCert}
                  />
                  <Button
                    variant="ghost"
                    startContent={<LuUpload />}
                    onPress={() => document.getElementById("clientCertInput").click()}
                  >
                    {"SSL certificate"}
                  </Button>
                  <Spacer x={2} />
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
                <Spacer y={2} />
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    id="clientKeyInput"
                    style={{ display: "none" }}
                    onChange={_selectClientKey}
                  />
                  <Button
                    variant="ghost"
                    startContent={<LuUpload />}
                    onPress={() => document.getElementById("clientKeyInput").click()}
                  >
                    {"SSL key"}
                  </Button>
                  <Spacer x={2} />
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
                <Spacer y={2} />
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    {"Certificates are accepted in .crt, .pem, and .key formats"}
                  </span>
                </div>
              </>
            )}
          </>
        )}

        <Spacer y={4} />
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

        <Spacer y={4} />
        <Row>
          <Button
            variant="ghost"
            auto
            onClick={() => _onCreateConnection(true)}
            isLoading={testLoading}
          >
            {"Test connection"}
          </Button>
          <Spacer x={1} />
          <Button
            isLoading={loading}
            onPress={_onCreateConnection}
            color="primary"
          >
            {"Save connection"}
          </Button>
        </Row>
      </div>

      {testResult && !testLoading && (
        <>
          <Spacer y={4} />
          <Divider />
          <Spacer y={4} />
          <div>
            <Row align="center">
              <div className="font-bold text-sm">
                {"Test Result "}
              </div>
              <Spacer x={2} />
              <Chip
                color={testResult.status < 400 ? "success" : "danger"}
                size="sm"
                variant="flat"
                radius="sm"
              >
                {`Status code: ${testResult.status}`}
              </Chip>
            </Row>
            <Spacer y={4} />
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
  const [copiedIP, setCopiedIP] = useState(false);

  return (
    <>
      <Row align="center">
        <RiArrowRightSLine />
        <Spacer x={1} />
        <div>
          {"You can add our IP address to the allow list to allow remote connections: "}
          <span className="font-bold">{"89.39.106.86"}</span>
        </div>
        <Spacer x={1} />
        <Button
          variant="light"
          size="sm"
          isIconOnly
          color={copiedIP ? "success" : "default"}
          onPress={() => {
            navigator.clipboard.writeText("89.39.106.86");
            setCopiedIP(true);
            setTimeout(() => {
              setCopiedIP(false);
            }, 2000);
          }}
        >
          {copiedIP ? <LuCopyCheck /> : <LuCopy />}
        </Button>
      </Row>
    </>
  );
}

ClickHouseConnectionForm.defaultProps = {
  onComplete: () => {},
  editConnection: null,
  addError: false,
};

ClickHouseConnectionForm.propTypes = {
  onComplete: PropTypes.func,
  editConnection: PropTypes.object,
  addError: PropTypes.bool,
};

export default ClickHouseConnectionForm;
