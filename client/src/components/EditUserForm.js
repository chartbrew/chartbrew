import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Button, Container, Divider, Input, Loading, Modal, Row, Spacer, Text,
} from "@nextui-org/react";

import { Delete } from "react-iconly";
import { updateUser, deleteUser } from "../actions/user";

/*
  Component for editting/deleting user account
*/
function EditUserForm(props) {
  const [user, setUser] = useState({ name: "" });
  const [submitError, setSubmitError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
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

  const loadData = () => {
    if (!userProp && !userProp.name) return;

    setLoading(false);
    setUser({ name: userProp.name });
  };

  const _onUpdateUser = () => {
    setSubmitError(false);
    setLoading(true);
    setSuccess(false);
    updateUser(userProp.id, user)
      .then(() => {
        setSuccess(true);
        setLoading(false);
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
      <Container>
        <Loading type={"spinner"} size="lg" />
      </Container>
    );
  }

  return (
    <Container
      css={{
        backgroundColor: "$backgroundContrast",
        br: "$md",
        "@xs": {
          p: 20,
        },
        "@sm": {
          p: 20,
        },
        "@md": {
          p: 20,
          m: 20,
        },
      }}
    >
      <Row>
        <Text h3>Profile settings</Text>
      </Row>
      <Spacer y={1} />
      <Row>
        <Input
          label="Name"
          name="name"
          value={user.name || ""}
          type="text"
          placeholder="Enter your name"
          onChange={(e) => setUser({ ...user, name: e.target.value })}
          bordered
          fullWidth
        />
      </Row>
      <Spacer y={0.5} />
      {submitError && (
        <>
          <Row>
            <Container css={{ backgroundColor: "$red300", p: 10 }}>
              <Row>
                <Text h5>{"There was an error updating your account"}</Text>
              </Row>
              <Row>
                <Text>Please try saving again.</Text>
              </Row>
            </Container>
          </Row>
          <Spacer y={0.5} />
        </>
      )}
      <Row>
        <Button
          disabled={!user.name || loading}
          color={success ? "success" : "primary"}
          onClick={_onUpdateUser}
          auto
          iconRight={loading ? <Loading type="points" /> : null}
        >
          {success ? "Saved" : "Save" }
        </Button>
      </Row>

      <Spacer y={1} />
      <Divider />
      <Spacer y={1} />

      <Row>
        <Button
          iconRight={<Delete />}
          color="error"
          onClick={() => setOpenDeleteModal(true)}
          bordered
          auto
        >
          Delete account
        </Button>
      </Row>

      <Modal blur open={openDeleteModal} onClose={() => setOpenDeleteModal(false)}>
        <Modal.Header>
          <Text h3>Delete Account</Text>
        </Modal.Header>
        <Modal.Body>
          <Container>
            <Row>
              <Text>{"This action will delete your account permanently, including your team and everything associated with it (projects, connections, and charts)."}</Text>
            </Row>
            <Spacer y={0.5} />
            <Row>
              <Text>{"We cannot reverse this action as all the content is deleted immediately."}</Text>
            </Row>
            <Spacer y={0.5} />
            <Row>
              <Text b>Are you sure you want to delete your user and team?</Text>
            </Row>
          </Container>
        </Modal.Body>
        <Modal.Footer>
          <Button
            onClick={() => setOpenDeleteModal(false)}
            color="warning"
            flat
            auto
          >
            {"Go back"}
          </Button>
          <Button
            color="error"
            disabled={loading}
            onClick={_onDeleteUser}
            iconRight={loading ? <Loading type="points" /> : <Delete />}
            auto
          >
            {"Delete forever"}
          </Button>
        </Modal.Footer>
      </Modal>

      {deleteUserError && (
        <Row>
          <Container css={{ backgroundColor: "$red300", p: 10 }}>
            <Row>
              <Text h5>{"Something went wrong while deleting your account"}</Text>
            </Row>
            <Row>
              <Text>Please try refreshing the page.</Text>
            </Row>
          </Container>
        </Row>
      )}
    </Container>
  );
}

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
