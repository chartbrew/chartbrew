import React, { useState } from "react";
import { connect, useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import {
  Button, Spacer, Input, Divider, Alert,
} from "@heroui/react";
import { LuArrowRight, LuLock, LuMail, LuUser } from "react-icons/lu";

import { addTeamMember } from "../slices/team";
import {
  required,
  email as emailValidation,
  password as passwordValidation
} from "../config/validations";
import Row from "../components/Row";
import Text from "../components/Text";
import { createUser, createInvitedUser } from "../slices/user";
import SimpleNavbar from "../components/SimpleNavbar";
import logo from "../assets/logo_blue.png";

/*
  The Signup page
*/
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

  const submitUser = () => {
    const params = new URLSearchParams(document.location.search);

    if (required(name)) {
      setErrors({ ...errors, name: required(name) });
      return;
    }

    if (emailValidation(email)) {
      setErrors({ ...errors, email: emailValidation(email) });
      return;
    }

    if (passwordValidation(password)) {
      setErrors({ ...errors, password: passwordValidation(password) });
      return;
    }

    setLoading(true);
    if (params.has("inviteToken")) {
      _createInvitedUser({ name, email, password }, params.get("inviteToken"));
    } else {
      dispatch(createUser({ name, email, password }))
        .then(() => {
          setLoading(false);
          navigate("/?welcome=true");
        })
        .catch((err) => {
          setLoading(false);
          setSignupError(err);
        });
    }
  };

  // invited user doesn't receive verificationUrl
  const _createInvitedUser = (values, inviteToken) => {
    dispatch(createInvitedUser(values))
      .then((data) => {
        const userData = data.payload;
        dispatch(addTeamMember({ userId: userData.id, inviteToken }))
          .then(() => {
            setLoading(false);
            setAddedToTeam(true);
            setTimeout(() => {
              navigate("/");
            }, 3000);
          });
      })
      .catch(() => {
        setLoading(false);
      });
  };

  return (
    <div>
      <SimpleNavbar />
      <div className="flex flex-col pt-[20px] sm:pt-[80px] w-full">
        <div className="mx-auto max-w-[400px] sm:max-w-[500px] px-4 sm:px-10">
          <div className="flex flex-col gap-2 items-center">
            <img src={logo} alt="Chartbrew" width={60} />
            <div className="flex flex-col items-center text-center">
              <h1 className={"text-3xl font-bold font-tw"}>
                {"Create your Chartbrew account"}
              </h1>
              <div className="text-gray-500">
                {"Enter your new sign in details"}
              </div>
            </div>
          </div>
          <Spacer y={8} />

          <form onSubmit={(e) => {
            e.preventDefault();
            submitUser();
          }}>
            <Row>
              <Input
                variant="bordered"
                startContent={<LuUser />}
                type="text"
                placeholder="Enter your name"
                labelPlacement="outside"
                onChange={(e) => {
                  setName(e.target.value);
                  setErrors({ ...errors, name: "" });
                }}
                value={name}
                fullWidth
                size="lg"
              />
            </Row>
            {errors.name && (
              <Row>
                <Text color="danger">
                  {"Please enter your name"}
                </Text>
              </Row>
            )}
            <Spacer y={2} />
            <Row>
              <Input
                variant="bordered"
                startContent={<LuMail />}
                type="email"
                placeholder="Enter your email"
                labelPlacement="outside"
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors({ ...errors, email: "" });
                }}
                value={email}
                fullWidth
                size="lg"
              />
            </Row>
            {errors.email && (
              <Row>
                <Text className={"text-danger"}>
                  {"Please enter a valid email"}
                </Text>
              </Row>
            )}
            <Spacer y={2} />
            <Row>
              <Input
                variant="bordered"
                startContent={<LuLock />}
                type="password"
                placeholder="Enter a secure password"
                labelPlacement="outside"
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors({ ...errors, password: "" });
                }}
                value={password}
                fullWidth
                size="lg"
              />
            </Row>
            {errors.password && (
              <div className="text-danger">
                {errors.password}
              </div>
            )}
            <Spacer y={4} />
            <Row>
              <Button
                onPress={submitUser}
                isLoading={loading}
                type="submit"
                size="lg"
                endContent={<LuArrowRight />}
                color="primary"
                isDisabled={addedToTeam}
                fullWidth
              >
                Continue
              </Button>
            </Row>
            {signupError && (
              <div className="text-danger">
                {signupError.message || signupError}
              </div>
            )}
            {addedToTeam && (
              <Alert
                className="mt-4"
                color="success"
                variant="flat"
                title="You have been added to the team"
                description="We will redirect you to your dashboard now..."
              />
            )}
          </form>

          <Spacer y={4} />
          <Text size="sm">
            {"By signing up for a Chartbrew account, you agree to our "}
            <a href="https://chartbrew.com/legal/terms" rel="noopener noreferrer" target="_blank">Terms of Service</a>
            {" and "}
            <a href="https://chartbrew.com/legal/privacy-policy" rel="noopener noreferrer" target="_blank">Privacy Policy</a>
          </Text>
          <Spacer y={4} />
          <Divider />
          <Spacer y={4} />
          <div>
            <Text size="sm">
              {" "}
              Already have an account?
              {" "}
              <Link to={"/login"} className="text-primary">Login here</Link>
              {" "}
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
}

const mapStateToProps = (state) => {
  return {
    form: state.forms,
    errors: state.error,
  };
};

const mapDispatchToProps = () => {
  return {
  };
};
export default connect(mapStateToProps, mapDispatchToProps)(Signup);
