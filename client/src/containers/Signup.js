import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Field, reduxForm } from "redux-form";
import { Link } from "react-router-dom";
import {
  Message, Divider, Container, Segment, Form, Button, Header, Icon, Label,
} from "semantic-ui-react";
import _ from "lodash";

import { createUser, createInvitedUser, oneaccountAuth } from "../actions/user";
import { addTeamMember } from "../actions/team";
import { required, email, password } from "../config/validations";
import cbLogoSmall from "../assets/logo_inverted.png";
import { blue, secondary } from "../config/colors";
import { cleanErrors as cleanErrorsAction } from "../actions/error";

import { ONE_ACCOUNT_ENABLED } from "../config/settings";

const queryString = require("qs"); // eslint-disable-line
/*
  Description
*/
class Signup extends Component {
  constructor(props) {
    super(props);

    this.state = {
      loading: false,
      oaloading: false,
    };
  }

  componentDidMount() {
    document.addEventListener("oneaccount-authenticated", this.authenticateOneaccount);
    const { cleanErrors } = this.props;
    cleanErrors();
  }

  componentWillUnmount() {
    document.removeEventListener("oneaccount-authenticated", this.authenticateOneaccount);
  }

  submitUser = (values) => {
    const { createUser, history } = this.props;

    const parsedParams = queryString.parse(document.location.search.slice(1));
    this.setState({ loading: true });
    if (parsedParams.inviteToken) {
      this._createInvitedUser(values, parsedParams.inviteToken);
    } else {
      createUser(values)
        .then(() => {
          this.setState({ loading: false });

          history.push("/user");
        })
        .catch(() => {
          this.setState({ loading: false });
        });
    }
  }

  // invited user doesn't receive verificationUrl
  _createInvitedUser = (values, inviteToken) => {
    const { createInvitedUser, addTeamMember, history } = this.props;
    createInvitedUser(values)
      .then((user) => {
        addTeamMember(user.id, inviteToken)
          .then(() => {
            this.setState({ loading: false, addedToTeam: true });
            setTimeout(() => {
              history.push("/user");
            }, 3000);
          });
      })
      .catch(() => {
        this.setState({ loading: false });
      });
  }

  authenticateOneaccount = (event) => {
    const { oneaccountAuth, history } = this.props;
    const data = event.detail;

    const parsedParams = queryString.parse(document.location.search.slice(1));
    if (!this._isMounted) return;
    this.setState({ oaloading: true });
    if (parsedParams.inviteToken) {
      this._createInvitedUser(data, parsedParams.inviteToken);
    } else {
      oneaccountAuth(data)
        .then(() => {
          if (!this._isMounted) return;
          this.setState({ oaloading: false });
          history.push("/user");
        });
    }
  }

  socialSignup() {
    const { oaloading } = this.state;
    return (
      <Container>
        <Button
          loading={oaloading}
          size="large"
          className="oneaccount-button oneaccount-show"
          style={styles.oneaccount}>
          {" "}
          <OneaccountSVG style={styles.oneaccountIcon} />
          Sign up with One account
        </Button>
      </Container>
    );
  }

  renderField({
    input, type, meta: { touched, error }, ...custom
  }) {
    const hasError = touched && error !== undefined;
    return (
      <Form.Field>
        { !hasError && <Message error header="Error" content={error} />}
        <Form.Input
          iconPosition="left"
          type={type}
          error={hasError}
          {...input} {...custom} /> {/* eslint-disable-line */}
        {touched
          && ((error && (
          <Label size="medium" style={{ marginTop: -30 }} basic pointing>
            {" "}
            {error}
            {" "}
          </Label>
          )))}
      </Form.Field>
    );
  }

  render() {
    const { handleSubmit, errors } = this.props;
    const {
      loading, addedToTeam,
    } = this.state;

    const signupError = _.find(errors, { pathname: window.location.pathname });

    return (
      <div style={styles.container}>
        <Container text textAlign="center">
          <Link to="/">
            <img size="tiny" centered src={cbLogoSmall} style={{ width: 70 }} alt="Chartbrew logo" />
          </Link>
          <Header inverted as="h2" style={{ marginTop: 0 }}>{"Time to brew some charts!"}</Header>

          <Segment color="olive" raised style={styles.verticalPadding} padded>
            <Form size="large">
              <Header as="h5" style={styles.leftAligned}>{"What's your name?"}</Header>
              <Field
                name="name"
                component={this.renderField}
                validate={required}
                placeholder="John Doe"
                icon="user"
                style={styles.leftAligned}
              />

              <Header as="h5" style={styles.leftAligned}>{"Your new sign in details"}</Header>
              <Field
                name="email"
                component={this.renderField}
                validate={[required, email]}
                placeholder="example@site.com"
                icon="mail"
              />
              <Field
                name="password"
                type="password"
                component={this.renderField}
                validate={[required, password]}
                placeholder="Enter a secure password"
                icon="lock"
                style={styles.leftAligned}
              />

              <Form.Field>
                <Button
                  onClick={handleSubmit(this.submitUser)}
                  icon
                  labelPosition="right"
                  primary
                  disabled={loading}
                  loading={loading}
                  type="submit"
                  size="large"
                >
                  <Icon name="right arrow" />
                  Sign Up
                </Button>
              </Form.Field>
              {signupError
              && (
              <Message negative>
                <Message.Header>{signupError.message}</Message.Header>
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
                  {this.socialSignup()}
                </>
              )}
            <Divider hidden />
            <p>
              {"By clicking Sign Up, you agree to our "}
              <a href="https://github.com/razvanilin/chartbrew-docs/blob/master/TermsAndConditions.md" rel="noopener noreferrer" target="_blank">Terms of Service</a>
              {" and "}
              <a href="https://github.com/razvanilin/chartbrew-docs/blob/master/PrivacyPolicy.md" rel="noopener noreferrer" target="_blank">Privacy Policy</a>
            </p>
          </Segment>
          <div>
            <p style={styles.loginText}>
              {" "}
              Already have an account?
              {" "}
              <Link to={"/login"} style={styles.loginLink}>Login here</Link>
              {" "}
            </p>
          </div>
        </Container>
      </div>
    );
  }
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

const validate = () => {
  const errors = {};
  return errors;
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
    backgroundColor: blue,
    minHeight: window.innerHeight,
    paddingBottom: 50,
    paddingTop: 50,
  },
  loginText: {
    color: "white",
  },
  loginLink: {
    color: secondary,
  },
  leftAligned: {
    textAlign: "left",
  },
  verticalPadding: {
    paddingRight: 40,
    paddingLeft: 40
  },
};

Signup.propTypes = {
  createUser: PropTypes.func.isRequired,
  oneaccountAuth: PropTypes.func.isRequired,
  handleSubmit: PropTypes.func.isRequired,
  addTeamMember: PropTypes.func.isRequired,
  createInvitedUser: PropTypes.func.isRequired,
  history: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
  errors: PropTypes.array.isRequired,
  cleanErrors: PropTypes.func.isRequired,
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
    createUser: user => dispatch(createUser(user)),
    oneaccountAuth: user => dispatch(oneaccountAuth(user)),
    addTeamMember: (userId, token) => dispatch(addTeamMember(userId, token)),
    createInvitedUser: user => dispatch(createInvitedUser(user)),
    cleanErrors: () => dispatch(cleanErrorsAction()),
  };
};
export default reduxForm({ form: "signup", validate })(connect(mapStateToProps, mapDispatchToProps)(Signup));
