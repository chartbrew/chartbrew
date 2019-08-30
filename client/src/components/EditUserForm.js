import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";

import {
  Segment, Modal, Message, Divider, Form, Icon, Button, Loader, Container,
  Header,
} from "semantic-ui-react";
import { updateUser, deleteUser } from "../actions/user";
/*
  Component for editting/deleting user account
*/
class EditUserForm extends Component {
  constructor(props) {
    super(props);

    this.state = {
      loading: true,
      user: {
        name: "",
        surname: "",
        icon: "",
      },
      btnIcon: "right arrow",
      success: false,
      submitError: false,
      openDeleteModal: false,
      deleteUserError: false,
    };
  }

  componentWillMount() {
    this.loadData(this.props);
  }

  componentWillReceiveProps(nextProps) {
    const { user } = this.state;
    if (!user.name) {
      this.loadData(nextProps);
    }
  }

  onChangeIcon(e, data) {
    const { user } = this.state;
    const re = /^[a-zA-Z]+$/;
    if (e.target.value === "" || re.test(e.target.value)) {
      this.setState({ user: { ...user, icon: data.value } });
    }
  }

  loadData = (props) => {
    this.setState({
      loading: false,
      user: {
        name: props.user.name, surname: props.user.surname, icon: props.user.icon
      }
    });
  }

  _onUpdateUser = () => {
    const { updateUser, userProp } = this.props;
    const { user } = this.state;

    this.setState({
      submitError: false, loading: true, success: false, btnIcon: "arrow right"
    });
    updateUser(userProp.id, user)
      .then(() => {
        this.setState({ success: true, loading: false, btnIcon: "check" });
      })
      .catch(() => {
        this.setState({ submitError: true, loading: false });
      });
  }

  _onDeleteUser = () => {
    const { deleteUser, userProp, history } = this.props;
    this.setState({ loading: true });
    deleteUser(userProp.id)
      .then(() => {
        history.push("/feedback");
      })
      .catch(() => {
        this.setState({ loading: false, deleteUserError: true, openDeleteModal: false });
      });
  }

  render() {
    const {
      user, submitError, loading, success, btnIcon, openDeleteModal,
      deleteUserError,
    } = this.state;

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
        <Segment raised attached>
          <Form>
            <Form.Input
              label="Firstname *"
              name="name"
              value={user.name || ""}
              type="text"
              placeholder="Name"
              icon="user"
              onChange={(e, data) => this.setState({
                user: { ...user, name: data.value }
              })} />
            <Form.Input
              label="Lastname *"
              name="surname"
              value={user.surname || ""}
              type="text"
              placeholder="Surname"
              icon="user"
              onChange={(e, data) => this.setState({
                user: { ...user, surname: data.value }
              })}
              />
            <Form.Input
              maxLength="2"
              label="User Icon *"
              name="icon"
              value={user.icon || ""}
              type="text"
              placeholder="User Icon consists of your Initials"
              onChange={(e, data) => this.onChangeIcon(e, data)}
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
            disabled={!user.name || !user.surname || !user.icon}
            floated="right"
            icon
            labelPosition="right"
            color={success ? "green" : "violet"}
            type="submit"
            onClick={() => this._onUpdateUser()}>
            {success ? "Saved" : "Save" }
            <Icon name={btnIcon} />
          </Button>
          <Divider hidden />

          <Container fluid>
            <Modal
              open={openDeleteModal}
              onClose={() => this.setState({ openDeleteModal: false })}
              trigger={(
                <Button onClick={() => this.setState({ openDeleteModal: true })} compact size="tiny" color="orange" icon>
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
                <Button onClick={() => this.setState({ openDeleteModal: false })}>
                  <Icon name="chevron left" />
                  {" Go back"}
                </Button>
                <Button color="red" loading={loading} onClick={this._onDeleteUser}>
                  <Icon name="checkmark" />
                  {" Delete forever"}
                </Button>
              </Modal.Actions>
            </Modal>
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
    user: state.user.data,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    updateUser: (id, data) => dispatch(updateUser(id, data)),
    deleteUser: id => dispatch(deleteUser(id)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(EditUserForm);
