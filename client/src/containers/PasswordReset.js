import React, { Component } from "react";
import { connect } from "react-redux";
import { PropTypes } from "prop-types";
import { withRouter } from "react-router";
import { Link } from "react-router-dom";
import {
  Segment, Message, Button, Header, Form, Input, Container
} from "semantic-ui-react";

import { changePasswordWithToken } from "../actions/user";
import { cleanErrors as cleanErrorsAction } from "../actions/error";
import { blue } from "../config/colors";
import cbLogoSmall from "../assets/cb_logo_4_small_inverted.png";

const queryString = require("qs"); // eslint-disable-line
/*
  Component for verifying a new user
*/
class PasswordReset extends Component {
  constructor(props) {
    super(props);

    this.state = {
      success: false,
      error: false,
    };
  }

  componentDidMount() {
    const { cleanErrors } = this.props;
    cleanErrors();
  }

  _onSubmit = () => {
    const { changePasswordWithToken, history } = this.props;
    const { password, passwordConfirm } = this.state;
    const parsedParams = queryString.parse(document.location.search.slice(1));

    if (!password || password.length < 6) {
      this.setState({ error: "Please enter at least 6 characters for your password" });
      return;
    }

    if (password !== passwordConfirm) {
      this.setState({ error: "The passwords are not matching" });
      return;
    }

    this.setState({ loading: true, success: false, error: false });
    changePasswordWithToken({
      token: parsedParams.token,
      hash: parsedParams.hash,
      password,
    })
      .then(() => {
        this.setState({
          success: true, loading: false, password: "", passwordConfirm: "",
        });
        setTimeout(() => {
          history.push("/login");
        }, 3000);
      })
      .catch(() => {
        this.setState({ loading: false, error: "The request failed, please try again or get in touch with us for help." });
      });
  }

  render() {
    const {
      loading, password, passwordConfirm, success, error,
    } = this.state;

    return (
      <div style={styles.container}>
        <Container text textAlign="center">
          <Link to="/">
            <img src={cbLogoSmall} style={{ width: 70 }} alt="Chartbrew logo" />
          </Link>

          <Header inverted as="h2" style={{ marginTop: 0 }}>
            Forgot your password?
            <Header.Subheader>{"No worries, complete the form below to change to a brand new one"}</Header.Subheader>
          </Header>

          <Segment textAlign="left" raised>
            <Form loading={loading}>
              <Form.Field>
                <label>New password</label>
                <Input
                  placeholder="Enter your new password"
                  type="password"
                  value={password || ""}
                  onChange={(e, data) => this.setState({ password: data.value })}
                />
              </Form.Field>
              <Form.Field>
                <label>Confirm your new password</label>
                <Input
                  placeholder="Write your new password again"
                  type="password"
                  value={passwordConfirm || ""}
                  onChange={(e, data) => this.setState({ passwordConfirm: data.value })}
                />
              </Form.Field>
              <Form.Field>
                <Button
                  type="submit"
                  size="large"
                  primary
                  fluid
                  disabled={success}
                  onClick={this._onSubmit}
                  content="Change password"
                />
              </Form.Field>
            </Form>

            {success
              && (
              <Message positive>
                <Message.Header>{"Your password was changed successfully"}</Message.Header>
                <p>{"You will now be redirected to the Login page where you can use your new password to authenticate."}</p>
              </Message>
              )}

            {error
              && (
              <Message negative>
                <Message.Header>{error}</Message.Header>
              </Message>
              )}
          </Segment>
        </Container>
      </div>
    );
  }
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: blue,
    minHeight: window.innerHeight,
    paddingBottom: 50,
    paddingTop: 50,
  },
};

PasswordReset.propTypes = {
  changePasswordWithToken: PropTypes.func.isRequired,
  history: PropTypes.object.isRequired,
  cleanErrors: PropTypes.func.isRequired,
};

const mapStateToProps = () => {
  return {
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    changePasswordWithToken: (data) => dispatch(changePasswordWithToken(data)),
    cleanErrors: () => dispatch(cleanErrorsAction()),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(PasswordReset));
