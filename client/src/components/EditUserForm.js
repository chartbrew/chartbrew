import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";

import {
  Segment, Modal, Message, Divider, Form, Icon, Button, Loader, Container,
  Header,
  TransitionablePortal,
} from "semantic-ui-react";
import { updateUser, deleteUser } from "../actions/user";
/*
  Component for editting/deleting user account
*/
function EditUserForm(props) {
  const [user, setUser] = useState({ name: "", icon: "" });
  const [submitError, setSubmitError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [btnIcon, setBtnIcon] = useState("right arrow");
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [deleteUserError, setDeleteUserError] = useState(false);

  const {
    userProp, updateUser, deleteUser, history
  } = props;

  useEffect(() => {
    if (userProp.name && !user.name) {
      loadData();
    }
  }, [userProp.name, user.name]);

  const onChangeIcon = (e, data) => {
    const re = /^[a-zA-Z]+$/;
    if (e.target.value === "" || re.test(e.target.value)) {
      setUser({ ...user, icon: data.value });
    }
  };

  const loadData = () => {
    if (!userProp && !userProp.name) return;

    setLoading(false);
    setUser({ name: userProp.name, icon: userProp.icon });
  };

  const _onUpdateUser = () => {
    setSubmitError(false);
    setLoading(true);
    setSuccess(false);
    setBtnIcon("arrow right");
    updateUser(userProp.id, user)
      .then(() => {
        setSuccess(true);
        setLoading(false);
        setBtnIcon("check");
      })
      .catch(() => {
        setSubmitError(true);
        setLoading(false);
      });
  };

  const _onDeleteUser = () => {
    setLoading(true);
    deleteUser(userProp.id)
      .then(() => {
        history.push("/feedback");
      })
      .catch(() => {
        setLoading(false);
        setDeleteUserError(true);
        setOpenDeleteModal(false);
      });
  };

  if (!user.name) {
    return (
      <Container text style={styles.container}>
        <Loader active />
      </Container>
    );
  }

  return (
    <div style={styles.container}>
      <Header attached="top" as="h3">Profile</Header>
      <Segment attached>
        <Form>
          <Form.Input
            label="Name"
            name="name"
            value={user.name || ""}
            type="text"
            placeholder="Name"
            icon="user"
            onChange={(e, data) => setUser({ ...user, name: data.value })} />
          <Form.Input
            maxLength="2"
            label="User Icon"
            name="icon"
            value={user.icon || ""}
            type="text"
            placeholder="User Icon consists of your Initials"
            onChange={(e, data) => onChangeIcon(e, data)}
          />
          {submitError && (
            <Container textAlign="center" style={{ margin: "1em" }}>
              <Message negative>
                <Message.Header>There was an error updating your account </Message.Header>
                <Message.Content> Please try again </Message.Content>
              </Message>
            </Container>
          )}
        </Form>
        <Divider hidden />
        <Button
          loading={loading}
          disabled={!user.name || !user.icon}
          floated="right"
          icon
          labelPosition="right"
          color={success ? "green" : "violet"}
          type="submit"
          onClick={() => _onUpdateUser()}>
          {success ? "Saved" : "Save" }
          <Icon name={btnIcon} />
        </Button>
        <Divider hidden />

        <Container fluid>
          <TransitionablePortal open={openDeleteModal}>
            <Modal
              open={openDeleteModal}
              onClose={() => setOpenDeleteModal(false)}
              trigger={(
                <Button onClick={() => setOpenDeleteModal(true)} compact size="tiny" color="orange" icon>
                  {" Delete Account"}
                  <Icon name="delete" />
                  {" "}
                </Button>
              )}
              basic
            >
              <Header icon="exclamation triangle" content="Delete Account" />
              <Modal.Content>
                <p>
                  This action will delete your account permanently,
                  all teams, projects and charts that you created.
                </p>
                <p>
                  Are you sure you want to delete it?
                </p>
              </Modal.Content>
              <Modal.Actions>
                <Button onClick={() => setOpenDeleteModal(false)}>
                  <Icon name="chevron left" />
                  {" Go back"}
                </Button>
                <Button color="red" loading={loading} onClick={_onDeleteUser}>
                  <Icon name="checkmark" />
                  {" Delete forever"}
                </Button>
              </Modal.Actions>
            </Modal>
          </TransitionablePortal>
        </Container>
        {deleteUserError && (
          <Container textAlign="center" text style={{ marginTop: 10 }}>
            <Message negative content="Something went wrong while deleting your account" />
          </Container>
        )}
      </Segment>
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
  },
};

EditUserForm.propTypes = {
  userProp: PropTypes.object.isRequired,
  updateUser: PropTypes.func.isRequired,
  deleteUser: PropTypes.func.isRequired,
  history: PropTypes.object.isRequired,
};
const mapStateToProps = (state) => {
  return {
    userProp: state.user.data,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    updateUser: (id, data) => dispatch(updateUser(id, data)),
    deleteUser: id => dispatch(deleteUser(id)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(EditUserForm);
