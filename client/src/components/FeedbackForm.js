import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Form, Button, Segment, Header, Divider, Message
} from "semantic-ui-react";
import { sendFeedback } from "../actions/user";

class FeedbackForm extends Component {
  constructor(props) {
    super(props);

    this.state = {
      loading: false,
      name: "",
      feedback: "",
      submitError: false,
      success: false,
    };
  }

  _onSendFeedback() {
    const { sendFeedback, user } = this.props;
    const { name, feedback } = this.state;

    this.setState({ loading: true, success: false, submitError: false });
    sendFeedback({
      name,
      feedback,
      email: user.email,
    })
      .then(() => {
        this.setState({ loading: false, success: true });
      })
      .catch(() => {
        this.setState({ loading: false, submitError: true });
      });
  }

  render() {
    const {
      success, submitError, feedback, loading,
    } = this.state;

    return (
      <div style={styles.container}>
        <Header attached="top" as="h2">Feedback & Suggestions</Header>
        <Segment raised attached>
          <Header content="We would appreciate any feedback you may have" />
          <Form>
            <Form.Input
              onChange={(e, data) => this.setState({ name: data.value })}
              name="name"
              label="Your name"
              placeholder="You can leave it anonymous" />
            <Form.TextArea
              onChange={(e, data) => this.setState({ feedback: data.value })}
              name="feedback"
              label="Your Comments"
              placeholder="Tell us about your exprience with our product" />
          </Form>
          <Divider hidden />
          {success
              && <Message positive content="We received your feedback and will work on it! Thank you." />}
          {submitError
              && <Message negative content="Something went wront, please try again or email us directly on info@depomo.com" />}
          <Button loading={loading} onClick={() => this._onSendFeedback()} disabled={!feedback} floated="right" primary>Send</Button>
          <Divider hidden section />
        </Segment>
      </div>
    );
  }
}

const styles = {
  container: {
    flex: 1,
  },
};
FeedbackForm.propTypes = {
  sendFeedback: PropTypes.func.isRequired,
  user: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => {
  return {
    user: state.user.data,
  };
};
const mapDispatchToProps = (dispatch) => {
  return {
    sendFeedback: (data) => dispatch(sendFeedback(data)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(FeedbackForm);
