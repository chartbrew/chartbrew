import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Field, reduxForm } from "redux-form";
import { Link } from "react-router-dom";
import {
  Message, Divider, Container, Segment, Form, Button, Header, Icon, Label,
} from "semantic-ui-react";

import { createUser, createInvitedUser } from "../actions/user";
import { addTeamMember } from "../actions/team";
import { required, email } from "../config/validations";
import cbLogoSmall from "../assets/cb_logo_4_small_inverted.png";
import { blue } from "../config/colors";

const queryString = require("qs"); // eslint-disable-line
/*
  Description
*/
class Signup extends Component {
  constructor(props) {
    super(props);

    this.state = {
      loading: false,
      success: false,
    };
  }

  submitUser = (values) => {
    const { createUser } = this.props;

    const parsedParams = queryString.parse(document.location.search.slice(1));
    this.setState({ loading: true });
    if (parsedParams.inviteToken) {
      this._createInvitedUser(values, parsedParams.inviteToken);
    } else {
      createUser(values)
        .then(() => {
          this.setState({ loading: false, success: true });
        })
        .catch((err) => {
          this.setState({ signupError: true, loading: false, errorMessage: err });
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
      .catch((err) => {
        this.setState({ signupError: true, loading: false, errorMessage: err });
      });
  }

  socialSignup() {
    return (
      <Container>
        <Button
          color="google plus"
        >
          {" "}
          <Icon name="google plus" />
          Sign up with Google
        </Button>
        <Button
          color="twitter"
        >
          {" "}
          <Icon name="twitter" />
          Sign up with Twitter
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
        <Form.Input iconPosition="left" type={type} error={hasError} {...input} {...custom} /> {/* eslint-disable-line */}
        {touched
          && ((error && (
          <Label size="medium" style={{ marginTop: "-4em" }} basic pointing>
            {" "}
            {error}
            {" "}
          </Label>
          )))}
      </Form.Field>
    );
  }

  render() {
    const { handleSubmit, user } = this.props;
    const {
      success, loading, signupError, errorMessage, addedToTeam,
    } = this.state;

    if (success && user) {
      return (
        <div style={styles.container}>
          <Container textAlign="center">
            <Header inverted as="h1">
              <span role="img" aria-label="wave">👋</span>
              {` Welcome to Chart Brew, ${user.name}!`}
              <Header.Subheader>We are very excited to have you here</Header.Subheader>
            </Header>
          </Container>
        </div>
      );
    }

    return (
      <div style={styles.container}>
        <Container text textAlign="center">
          <Link to="/">
            <img size="tiny" centered src={cbLogoSmall} style={{ width: 70 }} alt="Chartbrew logo" />
          </Link>
          <Header inverted as="h2" style={{ marginTop: 0 }}>Join Chart Brew</Header>

          <Segment color="olive" raised>
            <Form size="large">
              <p style={{ textAlign: "left" }}>{"What's your name?"}</p>
              <Field name="name" component={this.renderField} validate={required} placeholder="Firstname *" icon="user" />
              <Field name="surname" component={this.renderField} validate={required} placeholder="Surname *" icon="user" />
              <Divider />
              <p style={{ textAlign: "left" }}>Your new account details</p>
              <Field name="email" component={this.renderField} validate={[required, email]} placeholder="Email *" icon="mail" />
              <Field name="password" type="password" component={this.renderField} validate={required} placeholder="Password *" icon="lock" />
              <Field name="passwordconfirm" type="password" component={this.renderField} placeholder="Confirm Password *" icon="lock" />

              <Form.Field>
                <label>
                  {"By clicking Sign Up, you agree to our "}
                  <a href="https://github.com/razvanilin/chartbrew-docs/blob/master/TermsAndConditions.md" rel="noopener noreferrer" target="_blank">Terms</a>
                  {" and that you have read our "}
                  <a href="https://github.com/razvanilin/chartbrew-docs/blob/master/PrivacyPolicy.md" rel="noopener noreferrer" target="_blank">Privacy Policy</a>
                </label>
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
                <Message.Header>{errorMessage}</Message.Header>
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
            {/*
              <Divider horizontal>Or</Divider>
              this.socialSignup()
            */}
          </Segment>
          <Message>
            {" "}
            Already have an account?
            <Link to={"/login"}>Login here</Link>
            {" "}
          </Message>
        </Container>
      </div>
    );
  }
}
const validate = values => {
  const errors = {};
  if (!values.passwordconfirm || values.passwordconfirm !== values.password) {
    errors.passwordconfirm = "Passwords do not match";
  }
  return errors;
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: blue,
    minHeight: window.innerHeight,
    paddingBottom: 50,
    paddingTop: 50,
  },
};

Signup.propTypes = {
  createUser: PropTypes.func.isRequired,
  handleSubmit: PropTypes.func.isRequired,
  addTeamMember: PropTypes.func.isRequired,
  createInvitedUser: PropTypes.func.isRequired,
  history: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => {
  return {
    form: state.forms,
    user: state.user.data,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    createUser: user => dispatch(createUser(user)),
    addTeamMember: (userId, token) => dispatch(addTeamMember(userId, token)),
    createInvitedUser: user => dispatch(createInvitedUser(user)),
  };
};
export default reduxForm({ form: "signup", validate })(connect(mapStateToProps, mapDispatchToProps)(Signup));
