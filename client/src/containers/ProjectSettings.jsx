import React, { useEffect, useState } from "react";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import { PropTypes } from "prop-types";
import {
  Button, CircularProgress, Divider, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Spacer,
} from "@nextui-org/react";
import { ToastContainer, toast, Flip } from "react-toastify";
import "react-toastify/dist/ReactToastify.min.css";
import { LuClock4, LuTrash, LuX } from "react-icons/lu";

import canAccess from "../config/canAccess";
import { updateProject, changeActiveProject, removeProject } from "../actions/project";
import { cleanErrors as cleanErrorsAction } from "../actions/error";
import timezones from "../modules/timezones";
import Callout from "../components/Callout";
import Row from "../components/Row";
import Text from "../components/Text";
import useThemeDetector from "../modules/useThemeDetector";

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
  const [projectTimezone, setProjectTimezone] = useState("");
  const [timezoneSearch, setTimezoneSearch] = useState("");
  const [loadingTimezone, setLoadingTimezone] = useState(false);

  const isDark = useThemeDetector();

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
        toast.success("Project name updated!");
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

  const _onSaveTimezone = (clear) => {
    setLoadingTimezone(true);
    updateProject(project.id, { timezone: clear ? "" : projectTimezone })
      .then(() => {
        setProjectTimezone("");
        setTimezoneSearch("");
        setLoadingTimezone(false);
        changeActiveProject(project.id);
        toast.success("The timezone was updated successfully!");
      })
      .catch(() => {
        setLoadingTimezone(false);
        setError(true);
      });
  };

  const _onGetMachineTimezone = () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setProjectTimezone(tz);
    setTimezoneSearch("");
  };

  const _canAccess = (role) => {
    return canAccess(role, user.id, team.TeamRoles);
  };

  return (
    <div style={style} className="container mx-auto my-4 p-4 bg-content1 rounded-md">
      <Row>
        <Text size="h3">Project settings</Text>
      </Row>
      <Spacer y={1} />
      {!project.id && (
        <>
          <Row>
            <CircularProgress aria-label="Loading" />
          </Row>
          <Spacer y={1} />
        </>
      )}
      <Row>
        <form onSubmit={(e) => {
          e.preventDefault();
          _onSaveName();
        }} className="w-full">
          <Input
            label="Project name"
            placeholder="Type a project name"
            value={projectName ? projectName
              : project.name ? project.name : ""}
            onChange={(e) => setProjectName(e.target.value)}
            variant="bordered"
            color={nameError ? "success" : "default"}
            description={nameError ? "Project name is required" : ""}
            className="max-w-md"
          />
          <Spacer y={2} />
          <Button
            type="submit"
            color={success ? "success" : error ? "error" : "primary"}
            disabled={!_canAccess("admin")}
            onClick={_onSaveName}
            auto
            isLoading={loading}
          >
            {"Save name"}
          </Button>
        </form>
      </Row>

      <Spacer y={4} />
      <Divider />
      <Spacer y={4} />

      <Row align="center" wrap={"wrap"}>
        <Select
          label="Project timezone"
          placeholder="Select a timezone"
          variant="bordered"
          onSelectionChange={(keys) => {
            setTimezoneSearch("");
            setProjectTimezone(keys.currentKey);
          }}
          selectedKeys={[projectTimezone || project.timezone]}
          selectionMode="single"
          className="max-w-md"
        >
          {timezones
            .filter((timezone) => (
              timezone.toLowerCase().indexOf(timezoneSearch.toLocaleLowerCase()) > -1
            )).map((timezone) => (
              <SelectItem key={timezone} textValue={timezone}>
                {timezone}
              </SelectItem>
            ))}
        </Select>
        <Spacer x={1} />
        <Button
          color="primary"
          variant="bordered"
          disabled={!_canAccess("admin")}
          onClick={() => _onGetMachineTimezone()}
          startContent={<LuClock4 />}
        >
          <Text hideIn={"xs"}>
            Get current timezone
          </Text>
        </Button>
      </Row>
      <Spacer y={2} />
      <Row>
        <Button
          isDisabled={!_canAccess("admin")}
          onClick={() => _onSaveTimezone()}
          isLoading={loadingTimezone}
          color="primary"
        >
          Save
        </Button>
        <Spacer x={0.5} />
        {project.timezone && (
          <Button
            color="warning"
            variant="flat"
            disabled={!_canAccess("admin")}
            endContent={<LuX />}
            onClick={() => _onSaveTimezone(true)}
          >
            Clear
          </Button>
        )}
      </Row>

      <Spacer y={4} />
      <Divider />
      <Spacer y={4} />

      <Row>
        <Button
          color="danger"
          disabled={!_canAccess("admin")}
          endContent={<LuTrash />}
          onClick={_onRemoveConfirmation}
          variant="bordered"
        >
          Remove project
        </Button>
      </Row>

      {removeError && (
        <>
          <Spacer y={1} />
          <Row>
            <Callout
              title="Oh snap! There was a problem with the request"
              color="danger"
              text={"Please refresh the page and try again, or get in touch with us directly through the chat to help you out."}
            />
          </Row>
        </>
      )}

      <Modal isOpen={removeModal} backdrop="blur" onClose={() => setRemoveModal(false)}>
        <ModalContent>
          <ModalHeader>
            <Text size="h3">Are you sure you want to remove this project?</Text>
          </ModalHeader>
          <ModalBody>
            <Text>
              {"This action will be PERMANENT. All the charts, connections and saved queries associated with this project will be deleted as well."}
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onClick={() => setRemoveModal(false)}
            >
              Go back
            </Button>
            <Button
              color="danger"
              disabled={removeLoading}
              endContent={<LuTrash />}
              onClick={_onRemove}
            >
              Remove completely
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ToastContainer
        position="bottom-center"
        autoClose={1500}
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
