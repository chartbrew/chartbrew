import React, { useState } from "react";
import { connect, useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { useWindowSize } from "react-use";
import {
  Button, Card, Spacer, Input, Link as LinkNext, Avatar, CardHeader, CardBody,
} from "@nextui-org/react";
import { LuArrowRight, LuLock, LuMail, LuUser } from "react-icons/lu";

import { addTeamMember } from "../slices/team";
import {
  required,
  email as emailValidation,
  password as passwordValidation
} from "../config/validations";
import cbLogoSmall from "../assets/logo_blue.png";
import {
  negative, positive, secondary,
} from "../config/colors";
import signupBackground from "../assets/signup_background.webp";
import Row from "../components/Row";
import Text from "../components/Text";
import { createUser, createInvitedUser } from "../slices/user";

const testimonialAvatar = "https://cdn2.chartbrew.com/skyguy.webp";

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
  const [sideHovered, setSideHovered] = useState(false);

  const { height } = useWindowSize();
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
          navigate("/user?welcome=true");
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
              navigate("/user");
            }, 3000);
          });
      })
      .catch(() => {
        setLoading(false);
      });
  };

  return (
    <div style={styles.container(height)}>
      <div style={styles.mainGrid(height)} className="grid grid-cols-12">
        <div className="col-span-12 md:col-span-6">
          <div className="p-4 sm:p-8 md:p-16 lg:p-20">
            <Row>
              &nbsp;
            </Row>
            <Row justify="center">
              <Link to="/">
                <img src={cbLogoSmall} width="70" alt="Chartbrew logo" />
              </Link>
            </Row>
            <Spacer y={8} />
            <Row>
              <Text size="h2">
                {"Let's get you started with your new Chartbrew account"}
              </Text>
            </Row>
            <Spacer y={4} />

            <form onSubmit={(e) => {
              e.preventDefault();
              submitUser();
            }}>
              <Row>
                <Text>{"But first, how can we call you?"}</Text>
              </Row>
              <Spacer y={0.5} />
              <Row>
                <Input
                  variant="bordered"
                  contentRight={<LuUser />}
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
              <Spacer y={4} />
              {errors.name && (
              <Row>
                <Text color={negative}>
                  {"Please enter your name"}
                </Text>
              </Row>
              )}
              <Row>
                <Text>{"Enter your new sign in details"}</Text>
              </Row>
              <Spacer y={2} />
              <Row>
                <Input
                  variant="bordered"
                  endContent={<LuMail />}
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
                  endContent={<LuLock />}
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
              <Row>
                <Text color={negative}>
                  {errors.password}
                </Text>
              </Row>
              )}
              <Spacer y={4} />
              <Row>
                <Button
                  onClick={submitUser}
                  isLoading={loading}
                  type="submit"
                  size="lg"
                  endContent={<LuArrowRight />}
                  auto
                  color="primary"
                >
                  Continue
                </Button>
              </Row>
              {signupError && (
              <Row>
                <Text b color={negative}>{signupError.message || signupError}</Text>
              </Row>
              )}
              {addedToTeam && (
              <Row>
                <Text color={positive}>
                  {"You created a new account and were added to the team. We will redirect you to your dashboard now..."}
                </Text>
              </Row>
              )}
            </form>

            <Spacer y={2} />
            <Text size="sm">
              {"By signing up for a Chartbrew account, you agree to our "}
              <a href="https://github.com/razvanilin/chartbrew-docs/blob/master/TermsAndConditions.md" rel="noopener noreferrer" target="_blank">Terms of Service</a>
              {" and "}
              <a href="https://github.com/razvanilin/chartbrew-docs/blob/master/PrivacyPolicy.md" rel="noopener noreferrer" target="_blank">Privacy Policy</a>
            </Text>
            <Spacer y={0.5} />
            <div>
              <Text size="sm">
                {" "}
                Already have an account?
                {" "}
                <Link to={"/login"} style={styles.loginLink}>Login here</Link>
                {" "}
              </Text>
            </div>
          </div>
        </div>
        <div className="col-span-12 md:col-span-6">
          <div
            style={sideHovered ? styles.sideBackground : styles.sideBackgroundBlurred}
            onMouseEnter={() => setSideHovered(true)}
            onMouseLeave={() => setSideHovered(false)}
          />
          <div style={styles.testimonialCard} className="hidden sm:block">
            <Card style={{ minWidth: 500, padding: 10 }}>
              <CardHeader>
                <Avatar color="gradient" bordered squared size="lg" src={testimonialAvatar} alt="Fairchain testimonial" />
                <div className="grid grid-cols-12 pl-6">
                  <div className="col-span-12">
                    <Text size={20} b className={"leading-4"}>
                      Schuyler
                    </Text>
                  </div>
                  <div className="col-span-12">
                    <Text className="text-gray-400 flex flex-row">
                      {"Full-stack Developer at "}
                      <Spacer x={1} />
                      <LinkNext href="https://fairchain.art" rel="noopener noreferrer" target="_blank" color="secondary">
                        {"Fairchain"}
                      </LinkNext>
                    </Text>
                  </div>
                </div>
              </CardHeader>
              <CardBody>
                <i>{"\"Chartbrew has helped us move away from having to constantly update clunky Google-based charts, but what most impresses me is the responsiveness and the helpfulness of the people behind Chartbrew. Highly recommend!\""}</i>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: (height) => ({
    minHeight: height,
  }),
  loginLink: {
    color: secondary,
  },
  sideBackground: {
    backgroundImage: `url(${signupBackground})`,
    filter: "contrast(100%) blur(0px)",
    backgroundSize: "cover",
    backgroundPosition: "top",
    width: "100%",
    height: "100%",
    transition: "filter 1s ease",
    position: "relative",
  },
  sideBackgroundBlurred: {
    backgroundImage: `url(${signupBackground})`,
    filter: "contrast(130%) blur(5px)",
    backgroundSize: "cover",
    backgroundPosition: "top",
    width: "100%",
    height: "100%",
    position: "relative",
    transition: "filter 1s ease",
  },
  mainGrid: (height) => ({
    height: height + 20,
  }),
  testimonialCard: {
    position: "absolute",
    top: "25%",
    right: "5%",
    width: "40%",
  },
};

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
