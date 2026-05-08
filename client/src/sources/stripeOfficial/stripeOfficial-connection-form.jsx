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

import Row from "../../components/Row";
import { ButtonSpinner } from "../../components/ButtonSpinner";
import { testRequest } from "../../slices/connection";
import { selectTeam } from "../../slices/team";
import { useNavigate } from "react-router";

const STRIPE_API_HOST = "https://api.stripe.com/v1";

function StripeOfficialConnectionForm(props) {
  const { editConnection, onComplete, addError } = props;

  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [connection, setConnection] = useState({
    type: "stripeOfficial",
    subType: "stripeOfficial",
    host: STRIPE_API_HOST,
    name: "Stripe",
    authentication: { type: "api_key", token: "" },
    optionsArray: [],
  });
  const [errors, setErrors] = useState({});
  const [testResult, setTestResult] = useState(null);
  const [keyVisible, setKeyVisible] = useState(false);

  const dispatch = useDispatch();
  const team = useSelector(selectTeam);
  const navigate = useNavigate();

  useEffect(() => {
    if (editConnection) {
      setConnection({
        ...editConnection,
        host: editConnection.host || STRIPE_API_HOST,
        type: "stripeOfficial",
        subType: "stripeOfficial",
        authentication: {
          type: "api_key",
          token: editConnection.authentication?.token
            || editConnection.authentication?.apiKey
            || editConnection.authentication?.user
            || "",
        },
      });
    }
  }, [editConnection]);

  const _validate = () => {
    const nextErrors = {};
    const apiKey = connection.authentication?.token || "";

    if (!connection.name || connection.name.length > 24) {
      nextErrors.name = "Please enter a name which is less than 24 characters";
    }

    if (!apiKey) {
      nextErrors.apiKey = "Enter your Stripe secret or restricted API key";
    } else if (apiKey.startsWith("pk_")) {
      nextErrors.apiKey = "Publishable Stripe keys cannot read your Stripe data";
    } else if (!apiKey.startsWith("sk_") && !apiKey.startsWith("rk_")) {
      nextErrors.apiKey = "Stripe keys should start with sk_ or rk_";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const _buildConnection = () => ({
    ...connection,
    type: "stripeOfficial",
    subType: "stripeOfficial",
    host: STRIPE_API_HOST,
    authentication: {
      type: "api_key",
      token: connection.authentication?.token || "",
    },
    options: connection.options || {},
  });

  const _onTestRequest = () => {
    if (!_validate()) return;

    setTestLoading(true);
    setTestResult(null);
    dispatch(testRequest({ team_id: team?.id, connection: _buildConnection() }))
      .then(async (response) => {
        const body = await response.payload.text();
        setTestResult({
          status: response.payload.status,
          ok: response.payload.ok,
          body,
        });
      })
      .catch(() => {
        setTestResult({ ok: false, status: 400, body: "Stripe connection test failed" });
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

  const _onChangeApiKey = (value) => {
    setConnection({
      ...connection,
      authentication: {
        type: "api_key",
        token: value,
      },
    });
  };

  return (
    <div className="p-6 bg-surface border border-divider rounded-3xl">
      <div className="flex flex-row items-center justify-between">
        <p className="text-lg font-semibold">
          {!editConnection && "Connect to Stripe"}
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
          <TextField fullWidth className="max-w-[500px]" name="stripe-official-name" isInvalid={Boolean(errors.name)}>
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
          <TextField fullWidth className="max-w-[500px]" name="stripe-official-api-key" isInvalid={Boolean(errors.apiKey)}>
            <Label>Stripe secret or restricted key</Label>
            <div className="flex flex-row gap-2">
              <Input
                placeholder="rk_live_..."
                type={keyVisible ? "text" : "password"}
                value={connection.authentication?.token || ""}
                onChange={(e) => _onChangeApiKey(e.target.value)}
                variant="secondary"
              />
              <Button
                isIconOnly
                aria-label={keyVisible ? "Hide Stripe API key" : "Show Stripe API key"}
                variant="tertiary"
                onPress={() => setKeyVisible(!keyVisible)}
              >
                {keyVisible ? <LuEyeOff /> : <LuEye />}
              </Button>
            </div>
            {errors.apiKey ? <FieldError>{errors.apiKey}</FieldError> : null}
          </TextField>
        </Row>

        <div className="h-4" />
        <p className="max-w-[560px] text-sm text-foreground-500">
          Use a restricted key with read access to Balance, Balance Transactions, Payment Intents, Charges, Customers, Subscriptions, Invoices, Refunds, and Payouts.
        </p>
        <p className="max-w-[560px] text-sm text-foreground-500 mt-2">
          <Link href="https://docs.stripe.com/keys/restricted-api-keys" target="_blank" rel="noopener noreferrer">Learn more about creating restricted keys</Link>
        </p>

        {testResult && (
          <>
            <div className="h-4" />
            <Alert status={testResult.ok ? "success" : "danger"} className="shadow-none border border-divider">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>
                  {testResult.ok ? "Stripe connection test succeeded" : `Stripe connection test failed (${testResult.status})`}
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
  );
}

StripeOfficialConnectionForm.defaultProps = {
  editConnection: null,
  addError: null,
};

StripeOfficialConnectionForm.propTypes = {
  onComplete: PropTypes.func.isRequired,
  editConnection: PropTypes.object,
  addError: PropTypes.bool,
};

export default StripeOfficialConnectionForm;
