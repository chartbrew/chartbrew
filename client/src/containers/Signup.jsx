import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router";
import {
  Alert,
  Button,
  FieldError,
  InputGroup,
  Separator,
  TextField,
} from "@heroui/react";
import { LuLock, LuMail, LuUser } from "react-icons/lu";

import cbLogoDark from "../assets/cb_logo_dark.svg";
import cbLogoLight from "../assets/cb_logo_light.svg";
import { useTheme } from "../modules/ThemeContext";
import { addTeamMember } from "../slices/team";
import {
  required,
  email as emailValidation,
  password as passwordValidation,
} from "../config/validations";
import { createUser, createInvitedUser } from "../slices/user";

function Signup() {
  const [loading, setLoading] = useState(false);
  const [addedToTeam, setAddedToTeam] = useState(false);
  const [errors, setErrors] = useState({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupError, setSignupError] = useState("");

  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isDark } = useTheme();

  const getErrorMessage = (resp, fallbackMessage) => {
    return resp?.error?.message || fallbackMessage;
  };

  const submitUser = async (e) => {
    e.preventDefault();

    const params = new URLSearchParams(window.location.search);
    const nameError = required(name);
    const emailError = emailValidation(email);
    const passwordError = passwordValidation(password);

    if (nameError || emailError || passwordError) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        name: nameError || "",
        email: emailError || "",
        password: passwordError || "",
      }));
      return;
    }

    setLoading(true);
    setSignupError("");

    if (params.has("inviteToken")) {
      const createResp = await dispatch(createInvitedUser({ name, email, password }));

      if (createResp.error) {
        setSignupError(getErrorMessage(createResp, "Error creating invited user"));
        setLoading(false);
        return;
      }

      const userData = createResp.payload;
      const addMemberResp = await dispatch(
        addTeamMember({ userId: userData.id, inviteToken: params.get("inviteToken") })
      );

      if (addMemberResp?.error || addMemberResp?.payload?.error) {
        setSignupError(
          addMemberResp?.payload?.error || getErrorMessage(addMemberResp, "Unable to join team")
        );
        setLoading(false);
        return;
      }

      setLoading(false);
      setAddedToTeam(true);
      setTimeout(() => {
        navigate("/");
      }, 3000);
      return;
    }

    const resp = await dispatch(createUser({ name, email, password }));

    if (resp.error) {
      setSignupError(getErrorMessage(resp, "Error creating user"));
      setLoading(false);
      return;
    }

    setLoading(false);
    navigate("/?welcome=true");
  };

  return (
    <div className="min-h-screen bg-surface-secondary px-6 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col justify-between gap-12">
        <header className="flex flex-col items-center justify-center">
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
            <div className="space-y-2 text-center">
              <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground font-tw">
                Create your Chartbrew account
              </h1>
              <p className="text-sm text-muted">
                Enter your new sign in details
              </p>
            </div>

            <div className="h-8" />

            <form onSubmit={submitUser} className="space-y-3">
              <TextField
                fullWidth
                name="name"
                type="text"
                aria-label="Your name"
                isInvalid={Boolean(errors.name)}
              >
                <InputGroup fullWidth>
                  <InputGroup.Prefix>
                    <LuUser className="size-5 text-muted" aria-hidden />
                  </InputGroup.Prefix>
                  <InputGroup.Input
                    type="text"
                    placeholder="Full name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setErrors((currentErrors) => ({
                        ...currentErrors,
                        name: "",
                        signup: "",
                      }));
                    }}
                    className="text-base"
                  />
                </InputGroup>
                <FieldError>{errors.name || "Please enter your name"}</FieldError>
              </TextField>

              <TextField
                fullWidth
                name="email"
                type="email"
                aria-label="Your email"
                isInvalid={Boolean(errors.email)}
              >
                <InputGroup fullWidth>
                  <InputGroup.Prefix>
                    <LuMail className="size-5 text-muted" aria-hidden />
                  </InputGroup.Prefix>
                  <InputGroup.Input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrors((currentErrors) => ({
                        ...currentErrors,
                        email: "",
                        signup: "",
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
                aria-label="Your password"
                isInvalid={Boolean(errors.password)}
              >
                <InputGroup fullWidth>
                  <InputGroup.Prefix>
                    <LuLock className="size-5 text-muted" aria-hidden />
                  </InputGroup.Prefix>
                  <InputGroup.Input
                    type="password"
                    placeholder="Create a secure password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrors((currentErrors) => ({
                        ...currentErrors,
                        password: "",
                        signup: "",
                      }));
                    }}
                    className="text-base"
                  />
                </InputGroup>
                <FieldError>{errors.password || "Please enter a secure password"}</FieldError>
              </TextField>

              {signupError && (
                <p className="text-sm text-danger">
                  {signupError.message || signupError}
                </p>
              )}

              <Button
                isDisabled={addedToTeam}
                isPending={loading}
                type="submit"
                size="lg"
                variant="primary"
                fullWidth
                className="mt-2"
              >
                Continue
              </Button>

              {addedToTeam && (
                <Alert status="success" className="mt-4">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>You have been added to the team</Alert.Title>
                    <Alert.Description>
                      We will redirect you to your dashboard now...
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              )}
            </form>

            <div className="h-5" />
            <Separator />
            <div className="h-5" />

            <div className="text-center">
              <p className="text-sm text-muted">
                Already have an account?{" "}
                <Link to="/login" className="font-medium text-foreground hover:text-accent">
                  Login here
                </Link>
              </p>
            </div>
          </div>
        </main>

        <footer className="mx-auto max-w-md text-center text-sm text-muted">
          By signing up for a Chartbrew account, you agree to our{" "}
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
    </div>
  );
}

export default Signup;
