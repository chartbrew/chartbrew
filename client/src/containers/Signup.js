import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import {
  Message, Divider, Container, Segment, Form, Button, Header, Label, Grid, Image,
} from "semantic-ui-react";
import { useWindowSize } from "react-use";

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
import { secondary } from "../config/colors";
import signupBackground from "../assets/signup_background.webp";

import { ONE_ACCOUNT_ENABLED } from "../config/settings";

const breakpoints = {
  mobile: 0,
  tablet: 768,
  computer: 1024,
};

/*
  The Signup page
*/
function Signup(props) {
  const {
    createUser, history, createInvitedUser, addTeamMember, oneaccountAuth,
  } = props;

  const [loading, setLoading] = useState(false);
  const [oaloading, setOaloading] = useState(false);
  const [addedToTeam, setAddedToTeam] = useState(false);
  const [errors, setErrors] = useState({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupError, setSignupError] = useState("");

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
    setOaloading(true);
    if (params.has("inviteToken")) {
      _createInvitedUser(data, params.get("inviteToken"));
    } else {
      oneaccountAuth(data)
        .then(() => {
          setOaloading(false);
          history.push("/user");
        });
    }
  };

  const socialSignup = () => {
    return (
      <Container>
        <Button
          loading={oaloading}
          size="small"
          className="oneaccount-button oneaccount-show"
          style={styles.oneaccount}
          fluid
        >
          {" "}
          <OneaccountSVG style={styles.oneaccountIcon} />
          Sign up with One account
        </Button>
      </Container>
    );
  };

  return (
    <div style={styles.container(height)}>
      <Grid
        centered
        columns={width < breakpoints.computer ? 1 : 2}
        style={styles.mainGrid(height)}
        stackable
      >
        <Grid.Column width={width < breakpoints.computer ? 12 : 8}>
          <Segment basic text textAlign="left" padded={width < breakpoints.tablet ? null : "very"}>
            <Link to="/">
              <Image centered size="tiny" src={cbLogoSmall} style={{ width: 70 }} alt="Chartbrew logo" />
            </Link>
            <Header as="h2" style={{ marginTop: 10, textAlign: "center" }}>
              {"Let's get you started with your new account"}
              <Header.Subheader>Your live, connected dashboards await</Header.Subheader>
            </Header>
            <Divider hidden />

            <Form size="large" onSubmit={submitUser}>
              <Header size="mini">{"But first, how can we call you?"}</Header>
              <Form.Field>
                <Form.Input
                  icon="user"
                  iconPosition="left"
                  type="text"
                  placeholder="Enter your name"
                  onChange={(e, data) => {
                    setName(data.value);
                    setErrors({ ...errors, name: "" });
                  }}
                  value={name}
                />
                {errors.name && (
                  <Label size="medium" style={{ marginTop: "-4em" }} basic pointing>
                    {"Please enter your name"}
                  </Label>
                )}
              </Form.Field>

              <Header size="mini" style={styles.leftAligned}>{"Enter your new sign in details"}</Header>
              <Form.Field>
                <Form.Input
                  icon="mail"
                  iconPosition="left"
                  type="email"
                  placeholder="Enter your email"
                  onChange={(e, data) => {
                    setEmail(data.value);
                    setErrors({ ...errors, email: "" });
                  }}
                  value={email}
                />
                {errors.email && (
                  <Label size="medium" style={{ marginTop: "-4em" }} basic pointing>
                    {"Please enter a valid email"}
                  </Label>
                )}
              </Form.Field>
              <Form.Field>
                <Form.Input
                  icon="lock"
                  iconPosition="left"
                  type="password"
                  placeholder="Enter a secure password"
                  onChange={(e, data) => {
                    setPassword(data.value);
                    setErrors({ ...errors, password: "" });
                  }}
                  value={password}
                />
                {errors.password && (
                  <Label size="medium" style={{ marginTop: "-4em" }} basic pointing>
                    {errors.password}
                  </Label>
                )}
              </Form.Field>

              <Form.Field>
                <Button
                  onClick={submitUser}
                  primary
                  disabled={loading}
                  loading={loading}
                  type="submit"
                  size="large"
                  fluid
                >
                  Continue
                </Button>
              </Form.Field>
              {signupError && (
                <Message negative>
                  <Message.Header>{signupError.message || signupError}</Message.Header>
                  <p>Please try it again.</p>
                </Message>
              )}
              {addedToTeam
                && (
                <Message positive>
                  <Message.Header>
                    You created a new account and were added to the team
                  </Message.Header>
                  <p>{"We will redirect you to your dashboard now..."}</p>
                </Message>
                )}
            </Form>

            {ONE_ACCOUNT_ENABLED
                  && (
                    <>
                      <Divider horizontal>
                        Or
                      </Divider>
                      {socialSignup()}
                    </>
                  )}
            <Divider hidden />
            <p>
              {"By signing up for a Chartbrew account, you agree to our "}
              <a href="https://github.com/razvanilin/chartbrew-docs/blob/master/TermsAndConditions.md" rel="noopener noreferrer" target="_blank">Terms of Service</a>
              {" and "}
              <a href="https://github.com/razvanilin/chartbrew-docs/blob/master/PrivacyPolicy.md" rel="noopener noreferrer" target="_blank">Privacy Policy</a>
            </p>
            <div>
              <p style={styles.loginText}>
                {" "}
                Already have an account?
                {" "}
                <Link to={"/login"} style={styles.loginLink}>Login here</Link>
                {" "}
              </p>
            </div>
          </Segment>
        </Grid.Column>
        {width > breakpoints.computer && (
          <Grid.Column width={8} style={styles.sideBackground}>
            <div />
          </Grid.Column>
        )}
      </Grid>
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
    // backgroundColor: blue,
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
    backgroundSize: "cover",
    backgroundPosition: "top",
  },
  mainGrid: (height) => ({
    height: height + 20,
  }),
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
