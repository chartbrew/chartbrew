import React, { useEffect, useState } from "react";
import { connect, useDispatch, useSelector } from "react-redux";
import { PropTypes } from "prop-types";
import {
  Autocomplete,
  Button, ProgressCircle, Separator, EmptyState, Input, Label, ListBox, Modal, SearchField, useFilter,
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
import { ButtonSpinner } from "../components/ButtonSpinner";
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

  const [projectName, setProjectName] = useState("");
  const [nameError, setNameError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [removeModal, setRemoveModal] = useState(false);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [removeError, setRemoveError] = useState(false);
  const [projectTimezone, setProjectTimezone] = useState("");
  const [loadingTimezone, setLoadingTimezone] = useState(false);
  const { contains } = useFilter({ sensitivity: "base" });

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

    dispatch(updateProject({ project_id: project.id, data: { name: projectName } }))
      .then((data) => {
        if (data.error) {
          throw new Error(data.error);
        }
        setLoading(false);
        dispatch(changeActiveProject(project.id));
        toast.success("Dashboard name updated!");
      })
      .catch(() => {
        setLoading(false);
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
      <div className="h-8" />
      {!project.id && (
        <>
          <Row>
            <ProgressCircle aria-label="Loading" />
          </Row>
          <div className="h-2" />
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
            variant="secondary"
            isInvalid={nameError}
            description={nameError ? "Dashboard name is required" : ""}
            className="max-w-md"
          />
          <div className="h-4" />
          <Button
            type="submit" isDisabled={!_canAccess("projectEditor")}
            isPending={loading}
            onPress={_onSaveName}
            startContent={loading ? <ButtonSpinner /> : undefined}
          >
            {"Save name"}
          </Button>
        </form>
      </Row>

      <div className="h-8" />
      <Separator />
      <div className="h-8" />

      <Row align="center" wrap={"wrap"}>
        <Autocomplete
          placeholder="Select a timezone"
          selectionMode="single"
          variant="secondary"
          value={projectTimezone || project.timezone || null}
          onChange={(value) => {
            setProjectTimezone(value || "");
          }}
          className="max-w-md"
          aria-label="Timezone"
          fullWidth
        >
          <Label>Dashboard timezone</Label>
          <Autocomplete.Trigger>
            <Autocomplete.Value />
            <Autocomplete.ClearButton />
            <Autocomplete.Indicator />
          </Autocomplete.Trigger>
          <Autocomplete.Popover>
            <Autocomplete.Filter filter={contains}>
              <SearchField autoFocus name="timezone-search" variant="secondary">
                <SearchField.Group>
                  <SearchField.SearchIcon />
                  <SearchField.Input placeholder="Search timezones..." />
                  <SearchField.ClearButton />
                </SearchField.Group>
              </SearchField>
              <ListBox renderEmptyState={() => <EmptyState>No results found</EmptyState>}>
                {timezones.map((timezone) => (
                  <ListBox.Item key={timezone} id={timezone} textValue={timezone}>
                    {timezone}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Autocomplete.Filter>
          </Autocomplete.Popover>
        </Autocomplete>
        <div className="w-2" />
        <Button variant="ghost"
          isDisabled={!_canAccess("projectEditor")}
          onPress={() => _onGetMachineTimezone()}
          startContent={<LuClock4 />}
        >
          <Text hideIn={"xs"}>
            Get current timezone
          </Text>
        </Button>
      </Row>
      <div className="h-4" />
      <Row>
        <Button
          isDisabled={!_canAccess("projectEditor") || !projectTimezone || projectTimezone === project.timezone}
          isPending={loadingTimezone}
          onPress={() => _onSaveTimezone()}
          startContent={loadingTimezone ? <ButtonSpinner /> : undefined}
          color="primary"
        >
          Save
        </Button>
        <div className="w-1" />
        {project.timezone && (
          <Button
            color="warning"
            variant="tertiary"
            isDisabled={!_canAccess("projectEditor")}
            endContent={<LuX />}
            onPress={() => _onSaveTimezone(true)}
          >
            Clear
          </Button>
        )}
      </Row>

      {_canAccess("teamAdmin") && (
        <>
          <div className="h-8" />
          <Separator />
          <div className="h-8" />

          <Row>
            <Button
              color="danger"
              isDisabled={!_canAccess("teamAdmin")}
              endContent={<LuTrash />}
              onPress={_onRemoveConfirmation}
              variant="secondary"
            >
              Remove project
            </Button>
          </Row>
        </>
      )}

      {removeError && (
        <>
          <div className="h-2" />
          <Row>
            <Callout
              title="Oh snap! There was a problem with the request"
              color="danger"
              text={"Please refresh the page and try again, or get in touch with us directly through the chat to help you out."}
            />
          </Row>
        </>
      )}

      <Modal.Backdrop isOpen={removeModal} onOpenChange={setRemoveModal} variant="blur">
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-lg">
            <Modal.Header>
              <Modal.Heading>Are you sure you want to remove this project?</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
            <div>
              {"This action will be PERMANENT. All the charts this project will be deleted as well."}
            </div>
            <div>
              {"The connections and datasets used in these charts will not be deleted."}
            </div>
            </Modal.Body>
            <Modal.Footer>
            <Button
              variant="outline"
              onPress={() => setRemoveModal(false)}
            >
              Go back
            </Button>
            <Button
              variant="danger"
              isPending={removeLoading}
              onPress={_onRemove}
            >
              <LuTrash size={18} />
              Remove completely
            </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
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
