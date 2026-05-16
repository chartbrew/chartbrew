import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Button,
  FieldError,
  Input,
  Label,
  Link,
  TextField,
} from "@heroui/react";
import { LuEye, LuEyeOff } from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";

import Row from "../../components/Row";
import { ButtonSpinner } from "../../components/ButtonSpinner";
import { testRequest } from "../../slices/connection";
import { selectTeam } from "../../slices/team";

function normalizeSiteUrl(value = "") {
  return value.trim().replace(/\/+$/, "");
}

function JiraConnectionForm(props) {
  const { editConnection, onComplete, addError } = props;

  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [connection, setConnection] = useState({
    type: "jira",
    subType: "jira",
    host: "",
    name: "Jira",
    authentication: {
      type: "api_token",
      email: "",
      apiToken: "",
    },
    options: {
      jira: {},
    },
  });
  const [errors, setErrors] = useState({});
  const [testResult, setTestResult] = useState(null);
  const [tokenVisible, setTokenVisible] = useState(false);

  const dispatch = useDispatch();
  const team = useSelector(selectTeam);
  const navigate = useNavigate();

  useEffect(() => {
    if (editConnection) {
      setConnection({
        ...editConnection,
        type: "jira",
        subType: "jira",
        host: editConnection.host || editConnection.options?.jira?.siteUrl || "",
        authentication: {
          type: "api_token",
          email: editConnection.authentication?.email || editConnection.authentication?.user || "",
          apiToken: editConnection.authentication?.apiToken || editConnection.authentication?.token || "",
        },
        options: {
          ...(editConnection.options || {}),
          jira: {
            ...(editConnection.options?.jira || {}),
          },
        },
      });
    }
  }, [editConnection]);

  const validate = () => {
    const nextErrors = {};
    const siteUrl = normalizeSiteUrl(connection.host || "");
    const email = connection.authentication?.email || "";
    const apiToken = connection.authentication?.apiToken || "";

    if (!connection.name || connection.name.length > 24) {
      nextErrors.name = "Please enter a name which is less than 24 characters";
    }

    if (!/^https:\/\/[^/]+\.atlassian\.net$/i.test(siteUrl)) {
      nextErrors.host = "Enter a Jira Cloud URL like https://example.atlassian.net";
    }

    if (!email) {
      nextErrors.email = "Enter your Jira account email";
    }

    if (!apiToken) {
      nextErrors.apiToken = "Enter your Jira API token";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const buildConnection = () => {
    const siteUrl = normalizeSiteUrl(connection.host || "");

    return {
      ...connection,
      type: "jira",
      subType: "jira",
      host: siteUrl,
      authentication: {
        type: "api_token",
        email: connection.authentication?.email || "",
        apiToken: connection.authentication?.apiToken || "",
      },
      options: {
        ...(connection.options || {}),
        jira: {
          ...(connection.options?.jira || {}),
          siteUrl,
        },
      },
    };
  };

  const onChangeAuthentication = (updates) => {
    setConnection({
      ...connection,
      authentication: {
        ...connection.authentication,
        type: "api_token",
        ...updates,
      },
    });
  };

  const onTestRequest = () => {
    if (!validate()) return;

    setTestLoading(true);
    setTestResult(null);
    dispatch(testRequest({ team_id: team?.id, connection: buildConnection() }))
      .then(async (response) => {
        const body = await response.payload.text();
        setTestResult({
          status: response.payload.status,
          ok: response.payload.ok,
          body,
        });
      })
      .catch(() => {
        setTestResult({ ok: false, status: 400, body: "Jira connection test failed" });
      })
      .finally(() => setTestLoading(false));
  };

  const onCreateConnection = () => {
    if (!validate()) return;

    setLoading(true);
    onComplete(buildConnection())
      .then(() => setLoading(false))
      .catch(() => setLoading(false));
  };

  return (
    <div className="p-6 bg-surface border border-divider rounded-3xl">
      <div className="flex flex-row items-center justify-between">
        <p className="text-lg font-semibold">
          {!editConnection && "Connect to Jira"}
          {editConnection && `Edit ${editConnection.name}`}
        </p>
        {editConnection && (
          <Button
            variant="secondary"
            onPress={() => navigate("templates")}
          >
            Browse templates
          </Button>
        )}
      </div>

      <div className="mt-5 mb-5">
        <Row>
          <TextField fullWidth className="max-w-[500px]" name="jira-name" isInvalid={Boolean(errors.name)}>
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
          <TextField fullWidth className="max-w-[500px]" name="jira-site-url" isInvalid={Boolean(errors.host)}>
            <Label>Jira Cloud site URL</Label>
            <Input
              placeholder="https://example.atlassian.net"
              value={connection.host || ""}
              onChange={(e) => setConnection({ ...connection, host: e.target.value })}
              variant="secondary"
            />
            {errors.host ? <FieldError>{errors.host}</FieldError> : null}
          </TextField>
        </Row>

        <div className="h-4" />
        <Row>
          <TextField fullWidth className="max-w-[500px]" name="jira-email" isInvalid={Boolean(errors.email)}>
            <Label>Jira account email</Label>
            <Input
              placeholder="you@example.com"
              value={connection.authentication?.email || ""}
              onChange={(e) => onChangeAuthentication({ email: e.target.value })}
              variant="secondary"
            />
            {errors.email ? <FieldError>{errors.email}</FieldError> : null}
          </TextField>
        </Row>

        <div className="h-4" />
        <Row>
          <TextField fullWidth className="max-w-[500px]" name="jira-api-token" isInvalid={Boolean(errors.apiToken)}>
            <Label>Jira API token</Label>
            <div className="flex flex-row gap-2">
              <Input
                placeholder="Paste your Jira API token"
                type={tokenVisible ? "text" : "password"}
                value={connection.authentication?.apiToken || ""}
                onChange={(e) => onChangeAuthentication({ apiToken: e.target.value })}
                variant="secondary"
              />
              <Button
                isIconOnly
                aria-label={tokenVisible ? "Hide Jira API token" : "Show Jira API token"}
                variant="tertiary"
                onPress={() => setTokenVisible(!tokenVisible)}
              >
                {tokenVisible ? <LuEyeOff /> : <LuEye />}
              </Button>
            </div>
            {errors.apiToken ? <FieldError>{errors.apiToken}</FieldError> : null}
          </TextField>
        </Row>

        <div className="h-4" />
        <p className="max-w-[560px] text-sm text-foreground-500">
          Use a Jira Cloud API token for a user that can read the projects, boards, sprints, fields, and issues you want to chart.
        </p>
        <p className="max-w-[560px] text-sm text-foreground-500 mt-2">
          <Link href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer">Create or manage Jira API tokens</Link>
        </p>

        {testResult && (
          <>
            <div className="h-4" />
            <Alert status={testResult.ok ? "success" : "danger"} className="shadow-none border border-divider">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>
                  {testResult.ok ? "Jira connection test succeeded" : `Jira connection test failed (${testResult.status})`}
                </Alert.Title>
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
            onPress={onTestRequest}
            variant="tertiary"
          >
            {testLoading ? <ButtonSpinner /> : null}
            Test connection
          </Button>
          <Button
            isPending={loading}
            onPress={onCreateConnection}
            variant="primary"
          >
            {loading ? <ButtonSpinner /> : null}
            Save connection
          </Button>
        </div>
      </div>
    </div>
  );
}

JiraConnectionForm.defaultProps = {
  editConnection: null,
  addError: null,
};

JiraConnectionForm.propTypes = {
  onComplete: PropTypes.func.isRequired,
  editConnection: PropTypes.object,
  addError: PropTypes.bool,
};

export default JiraConnectionForm;
