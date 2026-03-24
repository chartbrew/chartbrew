import React, { useState } from "react";
import { useDispatch } from "react-redux";
import {
  Button, Input, Link, Modal, Separator,
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

  const loginUser = async (e) => {
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
    try {
      const data = await dispatch(login({ email, password }));
      
      if (data.error) {
        throw new Error(data.error?.message || "Wrong email or password");
      }

      const userData = data.payload;
      if (userData?.method_id) {
        setView2FaApp(true);
        setTwoFaData(userData);
        setLoading(false);
        return;
      }

      let result = "done";
      if (params.has("inviteToken")) {
        await dispatch(addTeamMember({ userId: userData.id, inviteToken: params.get("inviteToken") }));
        result = await dispatch(login({ email, password }));
      }

      if (result === "2fa") {
        setLoading(false);
        return;
      }

      setLoading(false);
      navigate("/");
    } catch (err) {
      setErrors({ ...errors, login: err.message });
      setLoading(false);
    }
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
            <div className="h-2" />
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
                color={errors.password ? "danger" : "default"}
                description={errors.password && "Please enter your password"}
                startContent={<LuLock />}
              />
            </Row>
            {errors.login && (
              <>
                <div className="h-2" />
                <p className="text-danger">
                  {errors.login}
                </p>
              </>
            )}
            <div className="h-4" />
            <Row justify="center" align="center">
              <Button
                onPress={loginUser}
                size="lg"
                isPending={loading}
                type="submit"
                fullWidth
                variant="primary"
              >
                Login
                <LuChevronRight />
              </Button>
            </Row>
            <div className="h-4" />
            <Separator />
            <div className="h-2" />
            <Row justify="center" align="center">
              <Link
                style={{ paddingTop: 10 }}
                onPress={() => setForgotModal(true)}
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

          <div className="h-2" />
          <div>
            <Button
              onPress={_onValidateToken}
              size="lg"
              isPending={loading}
              type="submit"
              fullWidth
              isDisabled={!otpToken}
              variant="primary"
            >
              Login
              <LuChevronRight />
            </Button>
          </div>
        </form>
      )}

      <Modal.Backdrop
        isOpen={forgotModal}
        onOpenChange={(isOpen) => {
          if (!isOpen) setForgotModal(false);
        }}
      >
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Reset your password</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
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
            </Modal.Body>
            <Modal.Footer>
              <Button onPress={() => setForgotModal(false)} variant="secondary">
                Close
              </Button>
              <Button
                isDisabled={resetDone}
                isPending={resetLoading}
                onPress={_onSendResetRequest}
                variant={resetDone ? "tertiary" : "primary"}
              >
                {resetDone ? "Request received" : "Send password reset email"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}

export default LoginForm;
