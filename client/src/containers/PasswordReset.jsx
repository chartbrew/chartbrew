import React, { useState, useEffect } from "react";
import { connect, useDispatch } from "react-redux";
import { PropTypes } from "prop-types";
import { Link, useNavigate } from "react-router-dom";
import {
  Button, Input, Spacer,
} from "@heroui/react";

import { changePasswordWithToken } from "../slices/user";
import { cleanErrors as cleanErrorsAction } from "../actions/error";
import cbLogoSmall from "../assets/logo_inverted.png";
import cbLogo from "../assets/logo_blue.png";
import Row from "../components/Row";
import Text from "../components/Text";
import { useTheme } from "../modules/ThemeContext";
import Callout from "../components/Callout";

/*
  Component for verifying a new user
*/
function PasswordReset(props) {
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const { cleanErrors } = props;
  const navigate = useNavigate();

  const { isDark } = useTheme();
  const dispatch = useDispatch();

  useEffect(() => {
    cleanErrors();
  }, []);

  const _onSubmit = () => {
    const params = new URLSearchParams(document.location.search);

    if (!password || password.length < 6) {
      setError("Please enter at least 6 characters for your password");
      return;
    }

    if (password !== passwordConfirm) {
      setError("The passwords are not matching");
      return;
    }
    setLoading(true);
    setSuccess(false);
    setError(false);
    dispatch(changePasswordWithToken({
      token: params.get("token"),
      hash: params.get("hash"),
      password,
    }))
      .then(() => {
        setSuccess(true);
        setLoading(false);
        setPassword("");
        setPasswordConfirm("");
        setTimeout(() => {
          navigate("/login");
        }, 3000);
      })
      .catch(() => {
        setLoading(false);
        setError("The request failed, please try again or get in touch with us for help.");
      });
  };

  return (
    <div style={styles.container}>
      <div className="container mx-auto max-w-xl px-4">
        <Row>
          <Link to="/">
            <img src={isDark ? cbLogoSmall : cbLogo} style={{ width: 70 }} alt="Chartbrew logo" />
          </Link>
        </Row>
        <Spacer y={4} />
        <Row>
          <Text size="h2">
            Forgot your password?
          </Text>
        </Row>
        <Row>
          <Text size="h4">{"No worries, complete the form below to change to a brand new one"}</Text>
        </Row>
        <Spacer y={4} />
        <Row>
          <Input
            label="New password"
            placeholder="Enter your new password"
            type="password"
            value={password || ""}
            onChange={(e) => setPassword(e.target.value)}
            variant="bordered"
            fullWidth
          />
        </Row>
        <Spacer y={2} />
        <Row>
          <Input
            label="Confirm your new password"
            placeholder="Write your new password again"
            type="password"
            value={passwordConfirm || ""}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            fullWidth
            variant="bordered"
          />
        </Row>
        <Spacer y={4} />
        <Row>
          <Button
            type="submit"
            size="lg"
            disabled={success}
            onClick={_onSubmit}
            color="primary"
            isLoading={loading}
          >
            Change password
          </Button>
        </Row>
        <Spacer y={1} />
        {success && (
          <Row>
            <Callout
              type="success"
              title="Your password was changed successfully"
              description="You will now be redirected to the Login page where you can use your new password to authenticate."
            />
          </Row>
        )}

        {error && (
          <Row>
            <Callout
              type="error"
              title="The password could not be changed"
              description={error}
            />
          </Row>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    paddingBottom: 50,
    paddingTop: 50,
  },
};

PasswordReset.propTypes = {
  cleanErrors: PropTypes.func.isRequired,
};

const mapStateToProps = () => {
  return {
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    cleanErrors: () => dispatch(cleanErrorsAction()),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(PasswordReset);
