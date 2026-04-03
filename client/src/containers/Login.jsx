import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router";
import {
  Button,
  FieldError,
  InputGroup,
  Link as HeroLink,
  Modal,
  Separator,
  TextField,
} from "@heroui/react";
import { LuLock, LuMail } from "react-icons/lu";

import cbLogoDark from "../assets/cb_logo_dark.svg";
import cbLogoLight from "../assets/cb_logo_light.svg";
import { useTheme } from "../modules/ThemeContext";
import {
  login,
  relog,
  requestPasswordReset,
  validate2faLogin,
} from "../slices/user";
import { addTeamMember } from "../slices/team";
import { required, email as validateEmail } from "../config/validations";

function Login() {
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetDone, setResetDone] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [forgotModal, setForgotModal] = useState(false);
  const [resetError, setResetError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [view2FaApp, setView2FaApp] = useState(false);
  const [otpToken, setOtpToken] = useState("");
  const [twoFaData, setTwoFaData] = useState(null);

  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isDark } = useTheme();

  const getErrorMessage = (resp, fallbackMessage) => {
    return resp?.error?.message || fallbackMessage;
  };

  useEffect(() => {
    const attemptRelog = async () => {
      const resp = await dispatch(relog());

      if (!resp.error && resp.payload?.id) {
        navigate("/");
      }
    };

    attemptRelog();
  }, [dispatch, navigate]);

  const onSendResetRequest = async () => {
    const emailError = validateEmail(resetEmail);

    if (emailError) {
      setResetError(emailError);
      return;
    }

    setResetError("");
    setResetLoading(true);

    const resp = await dispatch(requestPasswordReset(resetEmail));

    if (resp.error) {
      setResetLoading(false);
      setResetDone(true);
      return;
    }

    setResetLoading(false);
    setResetDone(true);
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    const params = new URLSearchParams(window.location.search);
    const emailError = validateEmail(email);
    const passwordError = required(password);

    if (emailError || passwordError) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        email: emailError || "",
        password: passwordError || "",
      }));
      return;
    }

    setLoading(true);
    setErrors((currentErrors) => ({
      ...currentErrors,
      email: "",
      password: "",
      login: "",
    }));

    let resp = await dispatch(login({ email, password }));

    if (resp.error) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        login: getErrorMessage(resp, "Wrong email or password"),
      }));
      setLoading(false);
      return;
    }

    const userData = resp.payload;

    if (userData?.method_id) {
      setView2FaApp(true);
      setTwoFaData(userData);
      setLoading(false);
      return;
    }

    if (params.has("inviteToken")) {
      const addMemberResp = await dispatch(
        addTeamMember({ userId: userData.id, inviteToken: params.get("inviteToken") })
      );

      if (addMemberResp.error) {
        setErrors((currentErrors) => ({
          ...currentErrors,
          login: getErrorMessage(addMemberResp, "Unable to accept invitation"),
        }));
        setLoading(false);
        return;
      }

      resp = await dispatch(login({ email, password }));

      if (resp.error) {
        setErrors((currentErrors) => ({
          ...currentErrors,
          login: getErrorMessage(resp, "Wrong email or password"),
        }));
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    navigate("/");
  };

  const onValidateToken = async (e) => {
    e.preventDefault();

    const params = new URLSearchParams(window.location.search);

    setLoading(true);
    setErrors((currentErrors) => ({
      ...currentErrors,
      otpToken: "",
    }));

    const resp = await dispatch(
      validate2faLogin({
        ...twoFaData,
        token: otpToken,
      })
    );

    if (resp.error) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        otpToken: "Invalid token",
      }));
      setLoading(false);
      return;
    }

    const userData = resp.payload;

    if (params.has("inviteToken")) {
      const addMemberResp = await dispatch(
        addTeamMember({ userId: userData.id, inviteToken: params.get("inviteToken") })
      );

      if (addMemberResp.error) {
        setErrors((currentErrors) => ({
          ...currentErrors,
          otpToken: getErrorMessage(addMemberResp, "Unable to accept invitation"),
        }));
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-surface-secondary px-6 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col justify-between gap-12">
        <header className="flex flex-col justify-center items-center">
          <Link to="/">
            <img
              src={isDark ? cbLogoDark : cbLogoLight}
              className="w-[150px]"
              alt="Chartbrew logo"
            />
          </Link>
        </header>

        <main className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md">
            {!view2FaApp && (
              <>
                <div className="space-y-2 text-center">
                  <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground font-tw">
                    Welcome back
                  </h1>
                  <p className="text-sm text-muted">
                    Sign in to your Chartbrew account
                  </p>
                </div>

                <div className="h-8" />

                <form onSubmit={handleLogin} className="space-y-3">
                  <TextField
                    fullWidth
                    name="email"
                    type="email"
                    aria-label="Email address"
                    isInvalid={Boolean(errors.email)}
                  >
                    <InputGroup fullWidth>
                      <InputGroup.Prefix>
                        <LuMail className="size-5 text-muted" aria-hidden />
                      </InputGroup.Prefix>
                      <InputGroup.Input
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setErrors((currentErrors) => ({
                            ...currentErrors,
                            email: "",
                            login: "",
                          }));
                        }}
                        className="text-base"
                      />
                    </InputGroup>
                    <FieldError>{errors.email || "Please enter a valid email"}</FieldError>
                  </TextField>

                  <TextField
                    fullWidth
                    name="password"
                    type="password"
                    aria-label="Password"
                    isInvalid={Boolean(errors.password)}
                  >
                    <InputGroup fullWidth>
                      <InputGroup.Prefix>
                        <LuLock className="size-5 text-muted" aria-hidden />
                      </InputGroup.Prefix>
                      <InputGroup.Input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setErrors((currentErrors) => ({
                            ...currentErrors,
                            password: "",
                            login: "",
                          }));
                        }}
                        className="text-base"
                      />
                    </InputGroup>
                    <FieldError>{errors.password || "Please enter your password"}</FieldError>
                  </TextField>

                  {errors.login && (
                    <p className="text-sm text-danger">
                      {errors.login}
                    </p>
                  )}

                  <Button
                    size="lg"
                    isPending={loading}
                    type="submit"
                    fullWidth
                    variant="primary"
                    className="mt-2"
                  >
                    Login
                  </Button>
                </form>

                <div className="h-5" />
                <Separator />
                <div className="h-5" />

                <div className="space-y-4 text-center">
                  <HeroLink
                    onPress={() => {
                      setForgotModal(true);
                      setResetDone(false);
                      setResetError("");
                      setResetEmail("");
                    }}
                    className="cursor-pointer text-sm text-foreground hover:text-accent"
                  >
                    Forgot password?
                  </HeroLink>

                  <p className="text-sm text-muted">
                    You don&apos;t have an account yet?{" "}
                    <Link to="/signup" className="font-medium text-foreground hover:text-accent">
                      Sign up here
                    </Link>
                  </p>
                </div>
              </>
            )}

            {view2FaApp && (
              <>
                <div className="space-y-2 text-center">
                  <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground">
                    Two-factor authentication
                  </h1>
                  <p className="text-sm text-muted">
                    Enter the token from your authenticator app
                  </p>
                </div>

                <div className="h-8" />

                <form onSubmit={onValidateToken} className="space-y-3">
                  <TextField
                    fullWidth
                    variant="secondary"
                    name="otpToken"
                    aria-label="Authentication token"
                    isInvalid={Boolean(errors.otpToken)}
                  >
                    <InputGroup variant="secondary" fullWidth>
                      <InputGroup.Prefix>
                        <LuLock className="size-5 text-muted" aria-hidden />
                      </InputGroup.Prefix>
                      <InputGroup.Input
                        placeholder="Authentication token"
                        value={otpToken}
                        onChange={(e) => {
                          setOtpToken(e.target.value);
                          setErrors((currentErrors) => ({
                            ...currentErrors,
                            otpToken: "",
                          }));
                        }}
                        className="text-base"
                      />
                    </InputGroup>
                    <FieldError>
                      {errors.otpToken || "Invalid token. Try a new one or use a backup code."}
                    </FieldError>
                  </TextField>

                  <Button
                    size="lg"
                    isPending={loading}
                    type="submit"
                    fullWidth
                    isDisabled={!otpToken}
                    variant="primary"
                    className="mt-2"
                  >
                    Login
                  </Button>
                </form>
              </>
            )}
          </div>
        </main>

        <footer className="mx-auto max-w-md text-center text-sm text-muted">
          By continuing to use Chartbrew, you agree to our{" "}
          <a
            href="https://chartbrew.com/legal/terms"
            rel="noopener noreferrer"
            target="_blank"
            className="font-medium text-foreground hover:text-accent"
          >
            Terms of Service
          </a>
          {" and "}
          <a
            href="https://chartbrew.com/legal/privacy-policy"
            rel="noopener noreferrer"
            target="_blank"
            className="font-medium text-foreground hover:text-accent"
          >
            Privacy Policy
          </a>
        </footer>
      </div>

      <Modal.Backdrop
        isOpen={forgotModal}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setForgotModal(false);
          }
        }}
      >
        <Modal.Container placement="center" className="px-4">
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Reset your password</Modal.Heading>
              <p className="mt-1 text-sm text-muted">
                We&apos;ll email you instructions if the address is registered with Chartbrew.
              </p>
            </Modal.Header>
            <Modal.Body className="space-y-4 p-1">
              <TextField
                fullWidth
                variant="secondary"
                name="resetEmail"
                type="email"
                aria-label="Reset email address"
                isInvalid={Boolean(resetError)}
              >
                <InputGroup variant="secondary" fullWidth>
                  <InputGroup.Prefix>
                    <LuMail className="size-5 text-muted" aria-hidden />
                  </InputGroup.Prefix>
                  <InputGroup.Input
                    placeholder="Email address"
                    value={resetEmail}
                    onChange={(e) => {
                      setResetEmail(e.target.value);
                      setResetError("");
                    }}
                    className="text-base"
                  />
                </InputGroup>
                <FieldError>{resetError}</FieldError>
              </TextField>

              {resetDone && (
                <p className="text-sm text-success">
                  We will send further instructions over email if the address is registered with
                  Chartbrew.
                </p>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button onPress={() => setForgotModal(false)} variant="secondary">
                Close
              </Button>
              <Button
                isDisabled={resetDone}
                isPending={resetLoading}
                onPress={onSendResetRequest}
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

export default Login;
