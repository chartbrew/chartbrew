import React, { useEffect, useState } from "react";
import { connect, useDispatch, useSelector } from "react-redux";
import { PropTypes } from "prop-types";
import {
  Autocomplete,
  AutocompleteItem,
  Button, CircularProgress, Divider, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spacer,
} from "@heroui/react";
import toast from "react-hot-toast";
import { LuClock4, LuTrash, LuX } from "react-icons/lu";
import { useNavigate } from "react-router";

import canAccess from "../config/canAccess";
import { updateProject, changeActiveProject, removeProject, selectProject } from "../slices/project";
import { cleanErrors as cleanErrorsAction } from "../actions/error";
import timezones from "../modules/timezones";
import Callout from "../components/Callout";
import Row from "../components/Row";
import Text from "../components/Text";
import Segment from "../components/Segment";
import { selectTeam } from "../slices/team";

/*
  Project settings page
*/
function ProjectSettings(props) {
  const {
    user, cleanErrors, style,
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
  const [loadingTimezone, setLoadingTimezone] = useState(false);

  const team = useSelector(selectTeam);
  const project = useSelector(selectProject);

  const navigate = useNavigate();
  const dispatch = useDispatch();

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

    dispatch(updateProject({ project_id: project.id, data: { name: projectName } }))
      .then((data) => {
        if (data.error) {
          throw new Error(data.error);
        }
        setLoading(false);
        setSuccess(true);
        dispatch(changeActiveProject(project.id));
        toast.success("Dashboard name updated!");
      })
      .catch(() => {
        setLoading(false);
        setError(true);
        toast.error("There was a problem updating the dashboard name. Please try again.");
      });
  };

  const _onRemoveConfirmation = () => {
    setRemoveModal(true);
  };

  const _onRemove = () => {
    setRemoveLoading(true);
    setRemoveError(false);
    dispatch(removeProject({ project_id: project.id }))
      .then(() => {
        navigate("/");
      })
      .catch(() => {
        setRemoveLoading(false);
        setRemoveError(true);
      });
  };

  const _onSaveTimezone = (clear) => {
    setLoadingTimezone(true);
    dispatch(updateProject({ project_id: project.id, data: { timezone: clear ? "" : projectTimezone } }))
      .then(() => {
        setProjectTimezone("");
        setLoadingTimezone(false);
        dispatch(changeActiveProject(project.id));
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
  };

  const _canAccess = (role) => {
    return canAccess(role, user.id, team.TeamRoles);
  };

  return (
    <Segment style={style} className="container mx-auto mt-4 bg-content1">
      <Row>
        <span className="text-lg font-bold">Dashboard settings</span>
      </Row>
      <Spacer y={4} />
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
            label="Dashboard name"
            placeholder="Type a name for your dashboard"
            value={projectName ? projectName
              : project.name ? project.name : ""}
            onChange={(e) => setProjectName(e.target.value)}
            variant="bordered"
            color={nameError ? "success" : "default"}
            description={nameError ? "Dashboard name is required" : ""}
            className="max-w-md"
          />
          <Spacer y={2} />
          <Button
            type="submit"
            color={success ? "success" : error ? "danger" : "primary"}
            isDisabled={!_canAccess("projectEditor")}
            onClick={_onSaveName}
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
        <Autocomplete
          label="Dashboard timezone"
          placeholder="Select a timezone"
          variant="bordered"
          onSelectionChange={(key) => {
            setProjectTimezone(key);
          }}
          selectedKey={projectTimezone || project.timezone}
          className="max-w-md"
          aria-label="Timezone"
        >
          {timezones.map((timezone) => (
            <AutocompleteItem key={timezone} textValue={timezone}>
              {timezone}
            </AutocompleteItem>
          ))}
        </Autocomplete>
        <Spacer x={1} />
        <Button
          color="primary"
          variant="light"
          disabled={!_canAccess("projectEditor")}
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
          isDisabled={!_canAccess("projectEditor") || !projectTimezone || projectTimezone === project.timezone}
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
            disabled={!_canAccess("projectEditor")}
            endContent={<LuX />}
            onClick={() => _onSaveTimezone(true)}
          >
            Clear
          </Button>
        )}
      </Row>

      {_canAccess("teamAdmin") && (
        <>
          <Spacer y={4} />
          <Divider />
          <Spacer y={4} />

          <Row>
            <Button
              color="danger"
              disabled={!_canAccess("teamAdmin")}
              endContent={<LuTrash />}
              onClick={_onRemoveConfirmation}
              variant="bordered"
            >
              Remove project
            </Button>
          </Row>
        </>
      )}

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
    </Segment>
  );
}

ProjectSettings.defaultProps = {
  style: {},
};

ProjectSettings.propTypes = {
  style: PropTypes.object,
  user: PropTypes.object.isRequired,
  cleanErrors: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => {
  return {
    user: state.user.data,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    cleanErrors: () => dispatch(cleanErrorsAction()),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(ProjectSettings);
