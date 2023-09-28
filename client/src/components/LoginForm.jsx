import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router-dom";
import {
  Button, Input, Spacer, Link, Modal, ModalHeader, ModalBody, ModalFooter, ModalContent,
} from "@nextui-org/react";
import { LuChevronRight, LuLock, LuMail } from "react-icons/lu";

import {
  login as loginAction,
  requestPasswordReset as requestPasswordResetAction,
  oneaccountAuth as oneaccountAuthAction,
} from "../actions/user";
import { addTeamMember as addTeamMemberAction } from "../actions/team";
import { required, email as validateEmail } from "../config/validations";
import { ONE_ACCOUNT_ENABLED } from "../config/settings";
import { negative } from "../config/colors";
import Container from "./Container";
import Row from "./Row";
import Text from "./Text";

/*
  Contains login functionality
*/
function LoginForm(props) {
  const {
    requestPasswordReset, oneaccountAuth, history, login, addTeamMember,
  } = props;

  const [loading, setLoading] = useState(false);
  const [oaloading, setOaloading] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetDone, setResetDone] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [forgotModal, setForgotModal] = useState(false);
  const [resetError, setResetError] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});

  useEffect(() => {
    document.addEventListener("oneaccount-authenticated", authenticateOneaccount);
    return () => {
      document.removeEventListener("oneaccount-authenticated", authenticateOneaccount);
    };
  }, []);

  const _onSendResetRequest = () => {
    if (validateEmail(resetEmail)) {
      setResetError(validateEmail(resetEmail));
      return;
    }

    setResetLoading(true);
    requestPasswordReset(resetEmail)
      .then(() => {
        setResetLoading(false);
        setResetDone(true);
      })
      .catch(() => {
        setResetLoading(false);
        setResetDone(true);
      });
  };

  const authenticateOneaccount = (event) => {
    const data = event.detail;
    setOaloading(true);
    oneaccountAuth(data)
      .then(() => {
        setOaloading(false);
        history.push("/user");
      });
  };

  const socialSignin = () => {
    return (
      <Container>
        <Spacer y={2} />
        <Row justify="center" align="center">
          <Button
            isLoading={oaloading}
            className="oneaccount-button oneaccount-show"
            style={styles.oneaccount}
          >
            {" "}
            <OneaccountSVG style={styles.oneaccountIcon} />
            Sign in with One account
          </Button>
        </Row>
      </Container>
    );
  };

  const loginUser = () => {
    const params = new URLSearchParams(document.location.search);

    if (validateEmail(email)) {
      setErrors({ ...errors, email: validateEmail(email) });
      return;
    }

    if (required(password)) {
      setErrors({ ...errors, password: required(password) });
      return;
    }

    setLoading(true);
    login({ email, password })
      .then((user) => {
        if (params.has("inviteToken")) {
          return addTeamMember(user.id, params.get("inviteToken"));
        }
        setLoading(false);
        return "done";
      })
      .then((result) => {
        if (result === "done") {
          return result;
        }

        return login({ email, password });
      })
      .then((user) => {
        setLoading(false);
        history.push("/user");
        return user;
      })
      .catch(() => {
        setLoading(false);
      });
  };

  return (
    <div style={styles.container} className="container mx-auto w-full">
      <form onSubmit={loginUser} className="sm:min-w-[500px]">
        <div className="w-full">
          <Row>
            <Input
              endContent={<LuMail />}
              type="email"
              placeholder="Enter your email"
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors({ ...errors, email: "" });
              }}
              value={email}
              size="lg"
              fullWidth
              variant="bordered"
              color={errors.email ? "danger" : "default"}
              description={errors.email}
            />
          </Row>
          {errors.email && (
            <Row>
              <Text color={negative}>
                {"Email is not valid"}
              </Text>
            </Row>
          )}
          <Spacer y={2} />
          <Row>
            <Input
              type="password"
              placeholder="Enter your password"
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors({ ...errors, password: "" });
              }}
              value={password}
              size="lg"
              fullWidth
              variant="bordered"
              color={errors.password ? "danger" : "default"}
              description={errors.password && "Please enter your password"}
              endContent={<LuLock />}
            />
          </Row>
          <Spacer y={4} />
          <Row justify="center" align="center">
            <Button
              onClick={loginUser}
              endContent={<LuChevronRight />}
              size="lg"
              color="primary"
              isLoading={loading}
              type="submit"
            >
              {"Login"}
            </Button>
          </Row>
          <Spacer y={0.5} />
          <Row justify="center" align="center">
            <Link
              style={{ paddingTop: 10 }}
              onClick={() => setForgotModal(true)}
            >
              Did you forget your password?
            </Link>
          </Row>
        </div>
      </form>

      <Modal isOpen={forgotModal} onClose={() => setForgotModal(false)} closeButton>
        <ModalContent>
          <ModalHeader>
            <Text size="h3">Reset your password</Text>
          </ModalHeader>
          <ModalBody>
            <Input
              label="Enter your email here"
              fullWidth
              onChange={(e) => setResetEmail(e.target.value)}
              contentRight={<LuMail />}
              variant="bordered"
            />
            {resetDone && (
            <Row>
              <Text color="green">{"We will send further instructions over email if the address is registered with Chartbrew."}</Text>
            </Row>
            )}
            {resetError && (
            <Row>
              <Text color={negative}>{resetError}</Text>
            </Row>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={() => setForgotModal(false)} variant="bordered">
              Close
            </Button>
            <Button
              isDisabled={resetDone}
              onClick={_onSendResetRequest}
              isLoading={resetLoading}
              color="primary"
              variant={resetDone ? "flat" : "solid"}
            >
              {resetDone ? "Request received" : "Send password reset email"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      {ONE_ACCOUNT_ENABLED && (
        <>
          {socialSignin()}
        </>
      )}
    </div>
  );
}

const OneaccountSVG = (props) => {
  const { style } = props;
  return (
    <svg style={style} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
      <g fill="none" fillRule="evenodd">
        <mask id="a">
          <rect width="100%" height="100%" fill="#fff" />
          <path
            fill="#000"
            d="M148.65 225.12c-30.6-5.51-71.54-106.68-55.76-137.06 14.38-27.7 102.01-13.66 116.08 20.9 13.82 33.97-32.89 121.1-60.32 116.16zm-30.35-76.6c0 18.24 13.68 33.02 30.55 33.02s30.54-14.78 30.54-33.02c0-18.25-13.67-33.03-30.54-33.03-16.87 0-30.55 14.78-30.55 33.03z"
          />
        </mask>
        <path
          fill="#fff"
          d="M153.27 298.95c60.25-10.84 140.8-209.72 109.75-269.44C234.72-24.95 62.25 2.66 34.57 70.6c-27.2 66.77 64.72 238.06 118.7 228.34z"
          mask="url(#a)"
        />
      </g>
    </svg>
  );
};

OneaccountSVG.propTypes = {
  style: PropTypes.object
};

OneaccountSVG.defaultProps = {
  style: {}
};

const styles = {
  oneaccount: {
    backgroundColor: "#FA4900",
    color: "white",
  },
  oneaccountIcon: {
    height: 18,
    verticalAlign: "sub",
    marginRight: 10,
  },
  oneaccountText: {
    verticalAlign: "middle",
  },
  container: {
    flex: 1,
  },
};

LoginForm.propTypes = {
  oneaccountAuth: PropTypes.func.isRequired,
  login: PropTypes.func.isRequired,
  addTeamMember: PropTypes.func.isRequired,
  history: PropTypes.object.isRequired,
  requestPasswordReset: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => {
  return {
    form: state.forms,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    oneaccountAuth: (user) => dispatch(oneaccountAuthAction(user)),
    login: (data) => dispatch(loginAction(data)),
    addTeamMember: (userId, token) => dispatch(addTeamMemberAction(userId, token)),
    requestPasswordReset: (email) => dispatch(requestPasswordResetAction(email)),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(LoginForm));
