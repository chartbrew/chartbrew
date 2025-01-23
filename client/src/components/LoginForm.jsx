import React, { useState } from "react";
import { connect, useDispatch } from "react-redux";
import {
  Button, Input, Spacer, Link, Modal, ModalHeader, ModalBody, ModalFooter, ModalContent, Divider,
} from "@heroui/react";
import { LuChevronRight, LuLock, LuMail } from "react-icons/lu";
import { useNavigate } from "react-router";

import {
  login, requestPasswordReset, validate2faLogin,
} from "../slices/user";
import { addTeamMember } from "../slices/team";
import { required, email as validateEmail } from "../config/validations";
import { negative } from "../config/colors";
import Row from "./Row";
import Text from "./Text";

/*
  Contains login functionality
*/
function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetDone, setResetDone] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [forgotModal, setForgotModal] = useState(false);
  const [resetError, setResetError] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [view2FaApp, setView2FaApp] = useState(false);
  const [otpToken, setOtpToken] = useState("");
  const [twoFaData, setTwoFaData] = useState(null);

  const navigate = useNavigate();
  const dispatch = useDispatch();

  const _onSendResetRequest = () => {
    if (validateEmail(resetEmail)) {
      setResetError(validateEmail(resetEmail));
      return;
    }

    setResetLoading(true);
    dispatch(requestPasswordReset(resetEmail))
      .then(() => {
        setResetLoading(false);
        setResetDone(true);
      })
      .catch(() => {
        setResetLoading(false);
        setResetDone(true);
      });
  };

  const loginUser = (e) => {
    e.preventDefault();

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
    dispatch(login({ email, password }))
      .then((data) => {
        if (data.error) {
          throw new Error(data.error?.message || "Wrong email or password");
        }

        const userData = data.payload;
        if (userData?.method_id) {
          setView2FaApp(true);
          setTwoFaData(userData);
          return "2fa"
        }

        if (params.has("inviteToken")) {
          return dispatch(addTeamMember({ userId: userData.id, inviteToken: params.get("inviteToken") }));
        }
        setLoading(false);
        return "done";
      })
      .then((result) => {
        if (result === "done" || result === "2fa") {
          return result;
        }

        return dispatch(login({ email, password }));
      })
      .then((result) => {
        if (result === "2fa") {
          setLoading(false);
          return;
        }
        setLoading(false);
        navigate("/");
      })
      .catch((err) => {
        setErrors({ ...errors, login: err.message });
        setLoading(false);
      });
  };

  const _onValidateToken = (e) => {
    e.preventDefault();

    const params = new URLSearchParams(document.location.search);

    setLoading(true);
    dispatch(validate2faLogin({
      ...twoFaData,
      token: otpToken,
    }))
      .then((data) => {
        if (data.error) {
          throw new Error("Invalid token");
        }
        const userData = data.payload;

        if (params.has("inviteToken")) {
          return dispatch(addTeamMember({ userId: userData.id, inviteToken: params.get("inviteToken") }));
        }
        return "done";
      })
      .then(() => {
        setLoading(false);
        navigate("/");
      })
      .catch(() => {
        setErrors({ ...errors, otpToken: "Invalid token" });
        setLoading(false);
      });
  }

  return (
    <div className="w-full py-2 px-4">
      {!view2FaApp && (
        <form onSubmit={loginUser} className="sm:min-w-[400px]">
          <div className="w-full">
            <Row>
              <Input
                startContent={<LuMail />}
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
                startContent={<LuLock />}
              />
            </Row>
            {errors.login && (
              <>
                <Spacer y={2} />
                <p className="text-danger">
                  {errors.login}
                </p>
              </>
            )}
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
            <Divider />
            <Spacer y={2} />
            <Row justify="center" align="center">
              <Link
                style={{ paddingTop: 10 }}
                onClick={() => setForgotModal(true)}
                className="cursor-pointer"
              >
                Forgot password?
              </Link>
            </Row>
          </div>
        </form>
      )}

      {view2FaApp && (
        <form onSubmit={_onValidateToken} className="sm:min-w-[500px] flex flex-col gap-2">
          <div className="font-bold">Two-factor authentication</div>
          <div>Enter the token from your authenticator app</div>

          <Input
            label="Token"
            placeholder="Enter your token here"
            variant="bordered"
            onChange={(e) => setOtpToken(e.target.value)}
          />

          {errors.otpToken && (
            <Row>
              <span className="text-danger">{"Invalid token. Try a new one or use a backup code."}</span>
            </Row>
          )}

          <Spacer />
          <div>
            <Button
              onClick={_onValidateToken}
              endContent={<LuChevronRight />}
              size="lg"
              color="primary"
              isLoading={loading}
              type="submit"
              fullWidth
              isDisabled={!otpToken}
            >
              {"Login"}
            </Button>
          </div>
        </form>
      )}

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

const mapStateToProps = (state) => {
  return {
    form: state.forms,
  };
};

const mapDispatchToProps = () => {
  return {
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(LoginForm);
