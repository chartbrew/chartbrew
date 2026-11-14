import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Button,
  FieldError,
  Input,
  Label,
  TextField,
  Tooltip,
} from "@heroui/react";
import { LuEye, LuEyeOff, LuInfo } from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";

import Row from "../../components/Row";
import { ButtonSpinner } from "../../components/ButtonSpinner";
import { testRequest } from "../../slices/connection";
import { selectTeam } from "../../slices/team";

const PRIVATUS_ANALYTICS_HOST = "https://privatusanalytics.com";
const SITE_ID_PATTERN = /^pa_[A-Za-z0-9]+$/;

export function getPrivatusAnalyticsSiteHost(siteId) {
  return `${PRIVATUS_ANALYTICS_HOST}/sites/${siteId}`;
}

export function getPrivatusAnalyticsSiteId(host) {
  const prefix = `${PRIVATUS_ANALYTICS_HOST}/sites/`;
  if (!host || !host.startsWith(prefix)) return "";

  const siteId = host.slice(prefix.length).replace(/\/$/, "");
  return SITE_ID_PATTERN.test(siteId) ? siteId : "";
}

function PrivatusAnalyticsConnectionForm(props) {
  const { editConnection, onComplete, addError } = props;

  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [connection, setConnection] = useState({
    type: "api",
    subType: "privatusAnalytics",
    name: "Privatus Analytics",
    authentication: { type: "bearer_token", token: "" },
    optionsArray: [],
  });
  const [siteId, setSiteId] = useState("");
  const [errors, setErrors] = useState({});
  const [testResult, setTestResult] = useState(null);
  const [tokenVisible, setTokenVisible] = useState(false);

  const dispatch = useDispatch();
  const team = useSelector(selectTeam);

  useEffect(() => {
    if (editConnection) {
      setConnection({
        ...editConnection,
        subType: "privatusAnalytics",
        authentication: {
          type: "bearer_token",
          token: editConnection.authentication?.token || "",
        },
      });
      setSiteId(getPrivatusAnalyticsSiteId(editConnection.host));
    }
  }, [editConnection]);

  const _validate = () => {
    const nextErrors = {};

    if (!connection.name || connection.name.length > 24) {
      nextErrors.name = "Please enter a name which is less than 24 characters";
    }

    if (!SITE_ID_PATTERN.test(siteId.trim())) {
      nextErrors.siteId = "Site IDs start with pa_ and use only letters and numbers";
    }

    const token = connection.authentication?.token || "";
    if (!token) {
      nextErrors.token = "Enter your Privatus Analytics API token";
    } else if (!token.startsWith("pat_")) {
      nextErrors.token = "API tokens start with pat_";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const _buildConnection = () => ({
    ...connection,
    type: "api",
    subType: "privatusAnalytics",
    host: getPrivatusAnalyticsSiteHost(siteId.trim()),
    authentication: {
      type: "bearer_token",
      token: (connection.authentication?.token || "").trim(),
    },
    options: [],
  });

  const _onTestRequest = () => {
    if (!_validate()) return;

    setTestLoading(true);
    setTestResult(null);
    dispatch(testRequest({ team_id: team?.id, connection: _buildConnection() }))
      .then((response) => {
        setTestResult({
          status: response.payload.status,
          ok: response.payload.ok,
        });
      })
      .catch(() => {
        setTestResult({ ok: false, status: 400 });
      })
      .finally(() => setTestLoading(false));
  };

  const _onCreateConnection = () => {
    if (!_validate()) return;

    setLoading(true);
    onComplete(_buildConnection())
      .then(() => setLoading(false))
      .catch(() => setLoading(false));
  };

  return (
    <div className="p-6 bg-surface border border-divider rounded-3xl">
      <div>
        <p className="text-lg font-semibold">
          {!editConnection && "Connect to Privatus Analytics"}
          {editConnection && `Edit ${editConnection.name}`}
        </p>
        <div className="mt-5 mb-5">
          <Row>
            <TextField fullWidth className="max-w-[500px]" name="privatus-analytics-name" isInvalid={Boolean(errors.name)}>
              <Label>Enter a name for your connection</Label>
              <Input
                placeholder="Enter a name you can recognize later"
                value={connection.name || ""}
                onChange={(e) => setConnection({ ...connection, name: e.target.value })}
                variant="secondary"
              />
              {errors.name ? <FieldError>{errors.name}</FieldError> : null}
            </TextField>
          </Row>

          <div className="h-4" />
          <Row>
            <TextField fullWidth className="max-w-[500px]" name="privatus-analytics-site-id" isInvalid={Boolean(errors.siteId)}>
              <div className="flex flex-row items-center gap-1">
                <Label>Site ID</Label>
                <Tooltip delay={0}>
                  <Tooltip.Trigger aria-label="Where to find the site ID">
                    <LuInfo size={14} className="text-foreground-500" />
                  </Tooltip.Trigger>
                  <Tooltip.Content>
                    The ID in your site address and tracking script, such as pa_7Q2K9XH3AB
                  </Tooltip.Content>
                </Tooltip>
              </div>
              <Input
                placeholder="pa_7Q2K9XH3AB"
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                variant="secondary"
              />
              {errors.siteId ? <FieldError>{errors.siteId}</FieldError> : null}
            </TextField>
          </Row>

          <div className="h-4" />
          <Row>
            <TextField fullWidth className="max-w-[500px]" name="privatus-analytics-token" isInvalid={Boolean(errors.token)}>
              <div className="flex flex-row items-center gap-1">
                <Label>API token</Label>
                <Tooltip delay={0}>
                  <Tooltip.Trigger aria-label="Where to create an API token">
                    <LuInfo size={14} className="text-foreground-500" />
                  </Tooltip.Trigger>
                  <Tooltip.Content>
                    Create a token in Privatus Analytics under Workspace settings, API tokens
                  </Tooltip.Content>
                </Tooltip>
              </div>
              <div className="flex flex-row gap-2">
                <Input
                  placeholder="pat_..."
                  type={tokenVisible ? "text" : "password"}
                  value={connection.authentication?.token || ""}
                  onChange={(e) => setConnection({
                    ...connection,
                    authentication: { type: "bearer_token", token: e.target.value },
                  })}
                  variant="secondary"
                />
                <Button
                  isIconOnly
                  aria-label={tokenVisible ? "Hide API token" : "Show API token"}
                  variant="tertiary"
                  onPress={() => setTokenVisible(!tokenVisible)}
                >
                  {tokenVisible ? <LuEyeOff /> : <LuEye />}
                </Button>
              </div>
              {errors.token ? <FieldError>{errors.token}</FieldError> : null}
            </TextField>
          </Row>

          {testResult && (
            <>
              <div className="h-4" />
              <Alert status={testResult.ok ? "success" : "danger"} className="shadow-none border border-divider">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>
                    {testResult.ok
                      ? "Privatus Analytics connection test succeeded"
                      : `Privatus Analytics connection test failed (${testResult.status})`}
                  </Alert.Title>
                  {!testResult.ok && (
                    <Alert.Description>Check the site ID and that the token can read this site.</Alert.Description>
                  )}
                </Alert.Content>
              </Alert>
            </>
          )}

          {addError && (
            <>
              <div className="h-4" />
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Server error while trying to save your connection</Alert.Title>
                  <Alert.Description>Please try again.</Alert.Description>
                </Alert.Content>
              </Alert>
            </>
          )}

          <div className="h-4" />
          <div className="flex flex-row gap-2">
            <Button
              isPending={testLoading}
              onPress={_onTestRequest}
              variant="tertiary"
            >
              {testLoading ? <ButtonSpinner /> : null}
              Test connection
            </Button>
            <Button
              isPending={loading}
              onPress={_onCreateConnection}
              variant="primary"
            >
              {loading ? <ButtonSpinner /> : null}
              Save connection
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

PrivatusAnalyticsConnectionForm.defaultProps = {
  editConnection: null,
  addError: null,
};

PrivatusAnalyticsConnectionForm.propTypes = {
  onComplete: PropTypes.func.isRequired,
  editConnection: PropTypes.object,
  addError: PropTypes.bool,
};

export default PrivatusAnalyticsConnectionForm;
