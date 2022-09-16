import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { useWindowSize } from "react-use";
import {
  Button,
  Card,
  Container,
  Grid,
  Loading,
  Row,
  Spacer,
  Text,
  Input,
  Link as LinkNext,
  Avatar,
} from "@nextui-org/react";

import { ArrowRight, Message, User } from "react-iconly";
import {
  createUser as createUserAction,
  createInvitedUser as createInvitedUserAction,
  oneaccountAuth as oneaccountAuthAction,
} from "../actions/user";
import { addTeamMember as addTeamMemberAction } from "../actions/team";
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

const breakpoints = {
  mobile: 0,
  tablet: 768,
  computer: 1024,
};

const testimonialAvatar = "https://cdn2.chartbrew.com/skyguy.webp";

/*
  The Signup page
*/
function Signup(props) {
  const {
    createUser, history, createInvitedUser, addTeamMember, oneaccountAuth,
  } = props;

  const [loading, setLoading] = useState(false);
  const [addedToTeam, setAddedToTeam] = useState(false);
  const [errors, setErrors] = useState({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupError, setSignupError] = useState("");
  const [sideHovered, setSideHovered] = useState(false);

  const { height, width } = useWindowSize();

  useEffect(() => {
    document.addEventListener("oneaccount-authenticated", authenticateOneaccount);

    return () => {
      document.removeEventListener("oneaccount-authenticated", authenticateOneaccount);
    };
  }, []);

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
      createUser({ name, email, password })
        .then(() => {
          setLoading(false);
          history.push("/user");
        })
        .catch((err) => {
          setLoading(false);
          setSignupError(err);
        });
    }
  };

  // invited user doesn't receive verificationUrl
  const _createInvitedUser = (values, inviteToken) => {
    createInvitedUser(values)
      .then((user) => {
        addTeamMember(user.id, inviteToken)
          .then(() => {
            setLoading(false);
            setAddedToTeam(true);
            setTimeout(() => {
              history.push("/user");
            }, 3000);
          });
      })
      .catch(() => {
        setLoading(false);
      });
  };

  const authenticateOneaccount = (event) => {
    const data = event.detail;

    const params = new URLSearchParams(document.location.search);
    if (params.has("inviteToken")) {
      _createInvitedUser(data, params.get("inviteToken"));
    } else {
      oneaccountAuth(data)
        .then(() => {
          history.push("/user");
        });
    }
  };

  return (
    <div style={styles.container(height)}>
      <Grid.Container style={styles.mainGrid(height)} css={{ backgroundColor: "$backgroundContrast" }}>
        <Grid xs={12} sm={6}>
          <Container xs>
            <Row>
              &nbsp;
            </Row>
            <Spacer size={1} />
            <Row justify="center">
              <Link to="/">
                <img centered src={cbLogoSmall} width="70" alt="Chartbrew logo" />
              </Link>
            </Row>
            <Spacer size={1} />
            <Row>
              <Text h2>
                {"Let's get you started with your new Chartbrew account"}
              </Text>
            </Row>
            <Spacer y={1} />

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
                  bordered
                  contentRight={<User />}
                  type="text"
                  placeholder="Enter your name"
                  onChange={(e) => {
                    setName(e.target.value);
                    setErrors({ ...errors, name: "" });
                  }}
                  value={name}
                  fullWidth
                  size="lg"
                  />
              </Row>
              <Spacer y={1} />
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
              <Spacer y={0.5} />
              <Row>
                <Input
                  bordered
                  contentRight={<Message />}
                  type="email"
                  placeholder="Enter your email"
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
                <Text color={negative}>
                  {"Please enter a valid email"}
                </Text>
              </Row>
              )}
              <Spacer y={1} />
              <Row>
                <Input.Password
                  bordered
                  icon="lock"
                  iconPosition="left"
                  type="password"
                  placeholder="Enter a secure password"
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
              <Spacer y={1} />
              <Row>
                <Button
                  onClick={submitUser}
                  disabled={loading}
                  type="submit"
                  size="lg"
                  iconRight={<ArrowRight />}
                  auto
                  shadow
                >
                  {!loading && "Continue"}
                  {loading && <Loading type="points" color="currentColor" />}
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

            <Spacer y={1} />
            <Text size={14}>
              {"By signing up for a Chartbrew account, you agree to our "}
              <a href="https://github.com/razvanilin/chartbrew-docs/blob/master/TermsAndConditions.md" rel="noopener noreferrer" target="_blank">Terms of Service</a>
              {" and "}
              <a href="https://github.com/razvanilin/chartbrew-docs/blob/master/PrivacyPolicy.md" rel="noopener noreferrer" target="_blank">Privacy Policy</a>
            </Text>
            <Spacer y={0.5} />
            <div>
              <Text size={14}>
                {" "}
                Already have an account?
                {" "}
                <Link to={"/login"} style={styles.loginLink}>Login here</Link>
                {" "}
              </Text>
            </div>
          </Container>
        </Grid>
        {width > breakpoints.tablet && (
          <Grid xs={12} sm={6}>
            <div
              style={sideHovered ? styles.sideBackground : styles.sideBackgroundBlurred}
              onMouseEnter={() => setSideHovered(true)}
              onMouseLeave={() => setSideHovered(false)}
            />
            <Container md style={styles.testimonialCard}>
              <Card style={{ minWidth: 500, padding: 10 }}>
                <Card.Header>
                  <Avatar color="gradient" bordered squared size="lg" src={testimonialAvatar} alt="Fairchain testimonial" />
                  <Grid.Container css={{ pl: "$6" }}>
                    <Grid xs={12}>
                      <Text size={20} b css={{ lineHeight: "$xs" }}>
                        Schuyler
                      </Text>
                    </Grid>
                    <Grid xs={12}>
                      <Text css={{ color: "$accents8", flexDirection: "row", display: "flex" }}>
                        {"Full-stack Developer at "}
                        <Spacer x={0.2} />
                        <LinkNext href="https://fairchain.com" rel="noopener noreferrer" target="_blank" color="secondary">
                          {"Fairchain"}
                        </LinkNext>
                      </Text>
                    </Grid>
                  </Grid.Container>
                </Card.Header>
                <Card.Body>
                  <i>{"\"Chartbrew has helped us move away from having to constantly update clunky Google-based charts, but what most impresses me is the responsiveness and the helpfulness of the people behind Chartbrew. Highly recommend!\""}</i>
                </Card.Body>
              </Card>
            </Container>
          </Grid>
        )}
      </Grid.Container>
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
  container: (height) => ({
    // backgroundColor: whiteTransparent(1),
    minHeight: height,
  }),
  loginText: {
    // color: "white",
  },
  loginLink: {
    color: secondary,
  },
  leftAligned: {
    textAlign: "left",
  },
  verticalPadding: {
    paddingRight: 20,
    paddingLeft: 20
  },
  sideBackground: {
    backgroundImage: `url(${signupBackground})`,
    filter: "contrast(100%) blur(0px)",
    backgroundSize: "cover",
    backgroundPosition: "top",
    width: "100%",
    height: "100%",
    transition: "filter 1s ease",
  },
  sideBackgroundBlurred: {
    backgroundImage: `url(${signupBackground})`,
    filter: "contrast(130%) blur(5px)",
    backgroundSize: "cover",
    backgroundPosition: "top",
    width: "100%",
    height: "100%",
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

Signup.propTypes = {
  createUser: PropTypes.func.isRequired,
  oneaccountAuth: PropTypes.func.isRequired,
  addTeamMember: PropTypes.func.isRequired,
  createInvitedUser: PropTypes.func.isRequired,
  history: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => {
  return {
    form: state.forms,
    user: state.user.data,
    errors: state.error,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    createUser: (user) => dispatch(createUserAction(user)),
    oneaccountAuth: (user) => dispatch(oneaccountAuthAction(user)),
    addTeamMember: (userId, token) => dispatch(addTeamMemberAction(userId, token)),
    createInvitedUser: (user) => dispatch(createInvitedUserAction(user)),
  };
};
export default connect(mapStateToProps, mapDispatchToProps)(Signup);
