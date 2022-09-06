import React, { useEffect, useState } from "react";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import { PropTypes } from "prop-types";
import {
  Button, Container, Divider, Input, Loading, Modal, Row, Spacer, Text,
} from "@nextui-org/react";
import { Delete } from "react-iconly";

import canAccess from "../config/canAccess";
import { updateProject, changeActiveProject, removeProject } from "../actions/project";
import { cleanErrors as cleanErrorsAction } from "../actions/error";

/*
  Project settings page
*/
function ProjectSettings(props) {
  const {
    user, team, project, cleanErrors, changeActiveProject, updateProject, removeProject,
    history, style,
  } = props;

  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [nameError, setNameError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [removeModal, setRemoveModal] = useState(false);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [removeError, setRemoveError] = useState(false);

  useEffect(() => {
    cleanErrors();
  }, []);

  const _onSaveName = () => {
    if (!projectName) {
      setNameError(true);
      return;
    }

    setLoading(true);
    setSuccess(false);
    setError(false);

    updateProject(project.id, { name: projectName })
      .then(() => {
        setLoading(false);
        setSuccess(true);
        changeActiveProject(project.id);
      })
      .catch(() => {
        setLoading(false);
        setError(true);
      });
  };

  const _onRemoveConfirmation = () => {
    setRemoveModal(true);
  };

  const _onRemove = () => {
    setRemoveLoading(true);
    setRemoveError(false);
    removeProject(project.id)
      .then(() => {
        history.push("/user");
      })
      .catch(() => {
        setRemoveLoading(false);
        setRemoveError(true);
      });
  };

  const _canAccess = (role) => {
    return canAccess(role, user.id, team.TeamRoles);
  };

  return (
    <Container
      style={style}
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
        "@lg": {
          p: 20,
          m: 20,
        },
      }}
    >
      <Row>
        <Text h3>Project settings</Text>
      </Row>
      <Spacer y={1} />
      {!project.id && (
        <>
          <Row>
            <Loading type="spinner" />
          </Row>
          <Spacer y={1} />
        </>
      )}
      <Row>
        <form onSubmit={(e) => {
          e.preventDefault();
          _onSaveName();
        }}>
          <Input
            label="Project name"
            placeholder="Type a project name"
            value={projectName ? projectName /* eslint-disable-line */
              : project.name ? project.name : ""}
            onChange={(e) => setProjectName(e.target.value)}
            css={{ minWidth: 300 }}
            bordered
            helperColor="error"
            helperText={nameError ? "Project name is required" : ""}
          />
          <Spacer y={0.5} />
          <Button
            type="submit"
            color={success ? "success" : error ? "error" : "primary"}
            disabled={!_canAccess("admin") || loading}
            onClick={_onSaveName}
            auto
          >
            {loading ? <Loading type="points" /> : "Save name"}
          </Button>
        </form>
      </Row>

      <Spacer y={1} />
      <Divider />
      <Spacer y={1} />

      <Row>
        <Button
          color="error"
          disabled={!_canAccess("admin")}
          iconRight={<Delete />}
          onClick={_onRemoveConfirmation}
          auto
          bordered
        >
          Remove project
        </Button>
      </Row>

      {removeError && (
        <>
          <Spacer y={1} />
          <Row>
            <Container css={{ backgroundColor: "$red300", p: 10 }}>
              <Row>
                <Text h5>{"Oh snap! There was a problem with the request"}</Text>
              </Row>
              <Row>
                <Text>{"Please refresh the page and try again, or get in touch with us directly through the chat to help you out."}</Text>
              </Row>
            </Container>
          </Row>
        </>
      )}

      <Modal open={removeModal} blur onClose={() => setRemoveModal(false)}>
        <Modal.Header>
          <Text h3>Are you sure you want to remove this project?</Text>
        </Modal.Header>
        <Modal.Body>
          <Text>
            {"This action will be PERMANENT. All the charts, connections and saved queries associated with this project will be deleted as well."}
          </Text>
        </Modal.Body>
        <Modal.Footer>
          <Button
            flat
            color="warning"
            onClick={() => setRemoveModal(false)}
            auto
          >
            Go back
          </Button>
          <Button
            color="error"
            disabled={removeLoading}
            iconRight={removeLoading ? <Loading type="points" /> : <Delete />}
            onClick={_onRemove}
            auto
          >
            Remove completely
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

ProjectSettings.defaultProps = {
  style: {},
};

ProjectSettings.propTypes = {
  style: PropTypes.object,
  user: PropTypes.object.isRequired,
  team: PropTypes.object.isRequired,
  history: PropTypes.object.isRequired,
  project: PropTypes.object.isRequired,
  updateProject: PropTypes.func.isRequired,
  changeActiveProject: PropTypes.func.isRequired,
  removeProject: PropTypes.func.isRequired,
  cleanErrors: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => {
  return {
    user: state.user.data,
    team: state.team.active,
    project: state.project.active,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    updateProject: (projectId, data) => dispatch(updateProject(projectId, data)),
    changeActiveProject: (projectId) => dispatch(changeActiveProject(projectId)),
    removeProject: (projectId) => dispatch(removeProject(projectId)),
    cleanErrors: () => dispatch(cleanErrorsAction()),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(ProjectSettings));
