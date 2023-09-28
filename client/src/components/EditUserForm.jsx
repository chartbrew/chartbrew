import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Button, Divider, Input, CircularProgress, Modal, Spacer, ModalHeader, ModalBody, ModalFooter, ModalContent,
} from "@nextui-org/react";
import { ToastContainer, toast, Flip } from "react-toastify";
import "react-toastify/dist/ReactToastify.min.css";
import { LuTrash } from "react-icons/lu";

import {
  updateUser as updateUserAction,
  deleteUser as deleteUserAction,
  requestEmailUpdate as requestEmailUpdateAction,
  updateEmail as updateEmailAction,
} from "../actions/user";
import Container from "./Container";
import Row from "./Row";
import Text from "./Text";
import Callout from "./Callout";
import useThemeDetector from "../modules/useThemeDetector";

/*
  Component for editting/deleting user account
*/
function EditUserForm(props) {
  const [user, setUser] = useState({ name: "" });
  const [userEmail, setUserEmail] = useState("");
  const [submitError, setSubmitError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [successEmail, setSuccessEmail] = useState(false);
  const [updateEmailToken, setUpdateEmailToken] = useState("");
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [deleteUserError, setDeleteUserError] = useState(false);

  const {
    userProp, updateUser, deleteUser, history, requestEmailUpdate, updateEmail,
  } = props;

  const isDark = useThemeDetector();

  useEffect(() => {
    const params = new URLSearchParams(document.location.search);
    if (params.get("email")) {
      setUpdateEmailToken(params.get("email"));
    }
  });

  useEffect(() => {
    if (userProp.name && !user.name) {
      loadData();
    }

    if (userProp.email) setUserEmail(userProp.email);
  }, [userProp, user]);

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

  const _onUpdateEmail = () => {
    setLoading(true);
    setSuccessEmail(false);
    requestEmailUpdate(userProp.id, userEmail)
      .then(() => {
        setSuccessEmail(true);
        setLoading(false);
        toast.success("You will receive a confirmation on your new email shortly.");
      })
      .catch(() => {
        toast.error("Error updating your email. Please try again or check if the email is correct.");
        setLoading(false);
      });
  };

  const _onUpdateEmailConfirm = () => {
    setLoading(true);
    setSuccessEmail(false);
    updateEmail(userProp.id, updateEmailToken)
      .then(() => {
        setSuccessEmail(true);
        setLoading(false);
        toast.success("Your email has been updated.");
        setUpdateEmailToken("");
        history.push("/edit");
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      })
      .catch(() => {
        toast.error("Error updating your email. Please try again or check if the email is correct.");
        setUpdateEmailToken("");
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
        <CircularProgress aria-label="Loading" size="lg" />
      </Container>
    );
  }

  return (
    <div className="container mx-auto px-4 py-4 md:px-10 flex flex-col gap-1">
      <Row>
        <Text size="h3">Profile settings</Text>
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
          variant="bordered"
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
          disabled={!user.name}
          color={success ? "success" : "primary"}
          onClick={_onUpdateUser}
          variant={success ? "flat" : "solid"}
          isLoading={loading}
        >
          {success ? "Saved" : "Save" }
        </Button>
      </Row>

      <Spacer y={4} />
      <Divider />
      <Spacer y={4} />

      <Row>
        <Input
          label="Your email"
          name="email"
          value={userEmail || ""}
          onChange={(e) => setUserEmail(e.target.value)}
          type="text"
          placeholder="Enter your email"
          variant="bordered"
          fullWidth
        />
      </Row>
      <Spacer y={0.5} />
      <Row>
        <Text>{"We will send you an email to confirm your new email address."}</Text>
      </Row>
      <Spacer y={0.5} />
      <Row>
        <Button
          disabled={!userEmail || userEmail === userProp.email}
          color={successEmail ? "success" : "primary"}
          onClick={_onUpdateEmail}
          variant={successEmail ? "flat" : "solid"}
          isLoading={loading}
        >
          {successEmail ? "We sent you an email" : "Update email" }
        </Button>
      </Row>

      <Spacer y={1} />
      <Divider />
      <Spacer y={1} />

      <Row>
        <Button
          iconRight={<LuTrash />}
          color="danger"
          onClick={() => setOpenDeleteModal(true)}
          bordered
          auto
        >
          Delete account
        </Button>
      </Row>

      <Modal backdrop="blur" isOpen={openDeleteModal} size="xl" onClose={() => setOpenDeleteModal(false)}>
        <ModalContent>
          <ModalHeader>
            <Text size="h3">Delete Account</Text>
          </ModalHeader>
          <ModalBody>
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
          </ModalBody>
          <ModalFooter>
            <Button
              onClick={() => setOpenDeleteModal(false)}
              variant="bordered"
            >
              {"Go back"}
            </Button>
            <Button
              color="danger"
              onClick={_onDeleteUser}
              isLoading={loading}
              auto
            >
              {"Delete forever"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal open={!!updateEmailToken}>
        <ModalHeader>
          <Text size="h3">Update email</Text>
        </ModalHeader>
        <ModalBody>
          <Text>Are you sure you want to update your email?</Text>
        </ModalBody>
        <ModalFooter>
          <Button
            color="warning"
            flat
            auto
            onClick={() => setUpdateEmailToken("")}
          >
            Cancel
          </Button>
          <Button
            color="primary"
            auto
            onClick={_onUpdateEmailConfirm}
          >
            Confirm
          </Button>
        </ModalFooter>
      </Modal>

      {deleteUserError && (
        <Row>
          <Callout
            title="Something went wrong while deleting your account"
            text={"Please try refreshing the page."}
            color="danger"
          />
        </Row>
      )}

      <ToastContainer
        position="top-right"
        autoClose={2500}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnVisibilityChange
        draggable
        pauseOnHover
        transition={Flip}
        theme={isDark ? "dark" : "light"}
      />
    </div>
  );
}

EditUserForm.propTypes = {
  userProp: PropTypes.object.isRequired,
  updateUser: PropTypes.func.isRequired,
  deleteUser: PropTypes.func.isRequired,
  history: PropTypes.object.isRequired,
  requestEmailUpdate: PropTypes.func.isRequired,
  updateEmail: PropTypes.func.isRequired,
};
const mapStateToProps = (state) => {
  return {
    userProp: state.user.data,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    updateUser: (id, data) => dispatch(updateUserAction(id, data)),
    deleteUser: id => dispatch(deleteUserAction(id)),
    requestEmailUpdate: (id, email) => requestEmailUpdateAction(id, email),
    updateEmail: (id, token) => updateEmailAction(id, token),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(EditUserForm);
