import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router-dom";
import { Field, reduxForm } from "redux-form";
import {
  Container, Form, Divider, Button, Message, Icon, Label, Item, Modal, Header, Input
} from "semantic-ui-react";

import { login, requestPasswordReset, oneaccountAuth } from "../actions/user";
import { addTeamMember } from "../actions/team";
import { required, email } from "../config/validations";

import { ONE_ACCOUNT_ENABLED } from "../config/settings";

const queryString = require("qs"); // eslint-disable-line
/*
  Contains login functionality
*/
function LoginForm(props) {
  const {
    requestPasswordReset,
    oneaccountAuth,
    history,
    login,
    addTeamMember,
    handleSubmit
  } = props;
  const [loading, setLoading] = useState(false);
  const [oaloading, setOaLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState(null);
  const [resetError, setResetError] = useState(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [forgotModal, setForgotModal] = useState(false);

  useEffect(() => {
    document.addEventListener("oneaccount-authenticated", authenticateOneaccount);

    return () => {
      document.removeEventListener("oneaccount-authenticated", authenticateOneaccount);
    };
  }, []);

  const _onSendResetRequest = () => {
    if (email(resetEmail)) {
      setResetError(email(resetEmail));
      return;
    }

    setResetLoading(true);
    setResetError(false);
    setResetSuccess(false);
    requestPasswordReset(resetEmail)
      .then(() => {
        setResetLoading(false);
        setResetSuccess(true);
      })
      .catch((error) => {
        if (error.message && error.message.indexOf("404") > -1) {
          setResetLoading(false);
          setResetError("We couldn't find anyone with this email address. Try another one.");
        } else {
          setResetLoading(false);
          setResetError("There was a problem with your request. Please try again or get in touch with us directly.");
        }
      });
  };

  const authenticateOneaccount = (event) => {
    const data = event.detail;
    setOaLoading(true);
    oneaccountAuth(data)
      .then(() => {
        setOaLoading(false);
        history.push("/user");
      });
  };

  const socialSignin = () => (
    <Container>
      <Button
        loading={oaloading}
        size="large"
        className="oneaccount-button oneaccount-show"
        style={styles.oneaccount}>
        {" "}
        <OneaccountSVG style={styles.oneaccountIcon} />
        Sign in with One account
      </Button>
    </Container>
  );

  const loginUser = (values) => {
    const parsedParams = queryString.parse(document.location.search.slice(1));

    setLoading(true);
    login(values).then((user) => {
      if (parsedParams.inviteToken) {
        addTeamMember(user.id, parsedParams.inviteToken);
      }
      setLoading(false);
      history.push("/user");
    }).catch(() => {
      setLoading(false);
    });
  };

  const renderField = ({
    input,
    type,
    meta: {
      touched,
      error
    },
    ...custom
  }) => {
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
  };

  return (
    <div style={styles.container}>
      <Form size="large">
        <Field name="email" component={renderField} validate={[required, email]} placeholder="Email" icon="mail" />
        <Field name="password" type="password" component={renderField} validate={required} placeholder="Password" icon="lock" />

        <Button
          onClick={handleSubmit(loginUser)}
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
          onClick={() => setForgotModal(true)}
        >
          <a href="#">Did you forget your password?</a>
        </Item>
      </Form>
      <Modal open={forgotModal} size="small" onClose={() => setForgotModal(false)}>
        <Header
          content="Reset your password"
          inverted
        />
        <Modal.Content>
          <Header size="small">{"We will send you an email with further instructions on your email"}</Header>
          <Input
            placeholder="Enter your email here"
            fluid
            onChange={(e, data) => setResetEmail(data.value)}
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
            onClick={() => setForgotModal(false)}
          >
            Close
          </Button>
          <Button
            primary
            disabled={resetSuccess}
            icon
            labelPosition="right"
            loading={resetLoading}
            onClick={_onSendResetRequest}
          >
            <Icon name="checkmark" />
            Send password reset email
          </Button>
        </Modal.Actions>
      </Modal>
      {ONE_ACCOUNT_ENABLED
        && (
          <>
            <Divider horizontal>
              Or
            </Divider>
            {socialSignin()}
          </>
        )}
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
  },
};

LoginForm.propTypes = {
  oneaccountAuth: PropTypes.func.isRequired,
  login: PropTypes.func.isRequired,
  handleSubmit: PropTypes.func.isRequired,
  addTeamMember: PropTypes.func.isRequired,
  history: PropTypes.object.isRequired,
  requestPasswordReset: PropTypes.func.isRequired,
};

OneaccountSVG.propTypes = {
  style: PropTypes.object
};

OneaccountSVG.defaultProps = {
  style: {}
};

const mapStateToProps = (state) => {
  return {
    form: state.forms,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    oneaccountAuth: user => dispatch(oneaccountAuth(user)),
    login: data => dispatch(login(data)),
    addTeamMember: (userId, token) => dispatch(addTeamMember(userId, token)),
    requestPasswordReset: (email) => dispatch(requestPasswordReset(email)),
  };
};

export default reduxForm({ form: "login", validate })(withRouter(connect(mapStateToProps, mapDispatchToProps)(LoginForm)));
