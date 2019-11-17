import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router-dom";
import { Field, reduxForm } from "redux-form";
import {
  Form, Button, Message, Icon, Label, Item, Modal, Header, Input
} from "semantic-ui-react";

import { login, requestPasswordReset } from "../actions/user";
import { addTeamMember } from "../actions/team";
import { required, email } from "../config/validations";

const queryString = require("qs"); // eslint-disable-line
/*
  Contains login functionality
*/
class LoginForm extends Component {
  constructor(props) {
    super(props);
    this.loginUser = this.loginUser.bind(this);
    this.state = {
      loading: false,
    };
  }

  _onSendResetRequest = () => {
    const { requestPasswordReset } = this.props;
    const { resetEmail } = this.state;

    if (email(resetEmail)) {
      this.setState({ resetError: email(resetEmail) });
      return;
    }

    this.setState({ resetLoading: true, resetError: false, resetSuccess: false });
    requestPasswordReset(resetEmail)
      .then(() => {
        this.setState({ resetLoading: false, resetSuccess: true });
      })
      .catch((error) => {
        if (error.message && error.message.indexOf("404") > -1) {
          this.setState({
            resetLoading: false,
            resetError: "We couldn't find anyone with this email address. Try another one.",
          });
        } else {
          this.setState({
            resetLoading: false,
            resetError: "There was a problem with your request. Please try again or get in touch with us directly.",
          });
        }
      });
  }

  loginUser(values) {
    const { login, addTeamMember, history } = this.props;
    const parsedParams = queryString.parse(document.location.search.slice(1));

    this.setState({ loading: true });
    login(values).then((user) => {
      if (parsedParams.inviteToken) {
        addTeamMember(user.id, parsedParams.inviteToken);
      }
      this.setState({ loading: false });
      history.push("/user");
    }).catch(() => {
      this.setState({ loading: false });
    });
  }

  renderField({
    input, type, meta: { touched, error }, ...custom
  }) {
    const hasError = touched && error !== undefined;
    return (
      <Form.Field>
        { !hasError && <Message error header="Error" content={error} />}
        <Form.Input iconPosition="left" type={type} error={hasError} {...input} {...custom} /> {/* eslint-disable-line */}
        {touched && ((error && (
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
    const { handleSubmit } = this.props;
    const {
      loading, forgotModal, resetSuccess, resetError,
      resetLoading,
    } = this.state;
    return (
      <div style={styles.container}>
        <Form size="large">
          <Field name="email" component={this.renderField} validate={[required, email]} placeholder="Email *" icon="mail" />
          <Field name="password" type="password" component={this.renderField} validate={required} placeholder="Password *" icon="lock" />

          <Button
            onClick={handleSubmit(this.loginUser)}
            icon
            size="large"
            labelPosition="right"
            primary
            disabled={loading}
            loading={loading}
            type="submit"
              >
            {" "}
            <Icon name="right arrow" />
              Login
          </Button>

          <Item
            style={{ paddingTop: 10 }}
            onClick={() => this.setState({ forgotModal: true })}
          >
            <a href="#">Forgot password?</a>
          </Item>
        </Form>
        {/*
          <Divider horizontal> Or </Divider>
          <Button compact color="google plus" icon="google plus" content="Use Google" />
          <Button compact color="twitter" icon="twitter" content="Use Twitter" />
        */}

        <Modal open={forgotModal} size="small" onClose={() => this.setState({ forgotModal: false })}>
          <Header
            content="Reset your password"
            inverted
          />
          <Modal.Content>
            <Header size="small">{"We will send you an email with further instructions on your email"}</Header>
            <Input
              placeholder="Enter your email here"
              fluid
              onChange={(e, data) => this.setState({ resetEmail: data.value })}
            />

            {resetSuccess
              && (
              <Message positive>
                <Message.Header>{"Check your email for further instructions"}</Message.Header>
              </Message>
              )}
            {resetError
              && (
              <Message negative>
                <Message.Header>{resetError}</Message.Header>
              </Message>
              )}
          </Modal.Content>
          <Modal.Actions>
            <Button
              onClick={() => this.setState({ forgotModal: false })}
            >
              Close
            </Button>
            <Button
              primary
              disabled={resetSuccess}
              icon
              labelPosition="right"
              loading={resetLoading}
              onClick={this._onSendResetRequest}
            >
              <Icon name="checkmark" />
              Send password reset email
            </Button>
          </Modal.Actions>
        </Modal>
      </div>
    );
  }
}

const validate = () => {
  const errors = {};
  return errors;
};

const styles = {
  container: {
    flex: 1,
  },
};

LoginForm.propTypes = {
  login: PropTypes.func.isRequired,
  handleSubmit: PropTypes.func.isRequired,
  addTeamMember: PropTypes.func.isRequired,
  history: PropTypes.object.isRequired,
  requestPasswordReset: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => {
  return {
    form: state.forms,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    login: data => dispatch(login(data)),
    addTeamMember: (userId, token) => dispatch(addTeamMember(userId, token)),
    requestPasswordReset: (email) => dispatch(requestPasswordReset(email)),
  };
};

export default reduxForm({ form: "login", validate })(withRouter(connect(mapStateToProps, mapDispatchToProps)(LoginForm)));
