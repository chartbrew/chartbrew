import React, { useState } from "react";
import PropTypes from "prop-types";
import { connect, useDispatch } from "react-redux";
import {
  Button, Input, Spacer, Link, Modal, ModalHeader, ModalBody, ModalFooter, ModalContent,
} from "@nextui-org/react";
import { LuChevronRight, LuLock, LuMail } from "react-icons/lu";
import { useNavigate } from "react-router";

import {
  login as loginAction,
  requestPasswordReset as requestPasswordResetAction,
  oneaccountAuth as oneaccountAuthAction,
} from "../actions/user";
import { addTeamMember } from "../slices/team";
import { required, email as validateEmail } from "../config/validations";
import { negative } from "../config/colors";
import Row from "./Row";
import Text from "./Text";

/*
  Contains login functionality
*/
function LoginForm(props) {
  const {
    requestPasswordReset, login,
  } = props;

  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetDone, setResetDone] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [forgotModal, setForgotModal] = useState(false);
  const [resetError, setResetError] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});

  const navigate = useNavigate();
  const dispatch = useDispatch();

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
          return dispatch(addTeamMember({ userId: user.id, inviteToken: params.get("inviteToken") }));
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
        navigate("/user");
        return user;
      })
      .catch(() => {
        setLoading(false);
      });
  };

  return (
    <div style={styles.container} className="container mx-auto w-full p-4">
      <form onSubmit={loginUser} className="sm:min-w-[500px]">
        <div className="w-full">
          <Row>
            <Input
              endContent={<LuMail />}
              type="email"
              placeholder="Enter your email"
              labelPlacement="outside"
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
              labelPlacement="outside"
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
              fullWidth
            >
              {"Login"}
            </Button>
          </Row>
          <Spacer y={4} />
          <Row justify="center" align="center">
            <Link
              style={{ paddingTop: 10 }}
              onClick={() => setForgotModal(true)}
              className="cursor-pointer"
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
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
  },
};

LoginForm.propTypes = {
  oneaccountAuth: PropTypes.func.isRequired,
  login: PropTypes.func.isRequired,
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
    requestPasswordReset: (email) => dispatch(requestPasswordResetAction(email)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(LoginForm);
