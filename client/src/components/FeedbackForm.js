import React, { useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Form, Button, Segment, Header, Divider, Message
} from "semantic-ui-react";
import { sendFeedback } from "../actions/user";

function FeedbackForm(props) {
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [name, setName] = useState("");

  const { sendFeedback, user } = props;

  const _onSendFeedback = () => {
    setLoading(true);
    setSuccess(false);
    setSubmitError(false);
    sendFeedback({
      name,
      feedback,
      email: user.email,
    })
      .then(() => {
        setLoading(false);
        setSuccess(true);
      })
      .catch(() => {
        setLoading(false);
        setSubmitError(true);
      });
  };

  return (
    <div style={styles.container}>
      <Header attached="top" as="h2">Feedback & Suggestions</Header>
      <Segment raised attached>
        <Header content="We would appreciate any feedback you may have" />
        <Form>
          <Form.Input
            onChange={(e, data) => setName(data.value)}
            name="name"
            label="Your name"
            placeholder="You can leave it anonymous" />
          <Form.TextArea
            onChange={(e, data) => setFeedback(data.value)}
            name="feedback"
            label="Your Comments"
            placeholder="Tell us about your exprience with our product" />
        </Form>
        <Divider hidden />
        {success
            && <Message positive content="We received your feedback and will work on it! Thank you." />}
        {submitError
            && <Message negative content="Something went wront, please try again or email us directly on info@depomo.com" />}
        <Button loading={loading} onClick={() => _onSendFeedback()} disabled={!feedback} floated="right" primary>Send</Button>
        <Divider hidden section />
      </Segment>
    </div>
  );
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
