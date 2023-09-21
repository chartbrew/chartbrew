import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Input, Button, Spacer, Modal, ModalHeader, ModalBody, ModalContent, Tabs, Tab
} from "@nextui-org/react";

import { createProject } from "../actions/project";
import CustomTemplates from "../containers/Connections/CustomTemplates/CustomTemplates";
import Row from "./Row";
import Text from "./Text";
import { IoArrowForward } from "react-icons/io5";

/*
  Contains the project creation functionality
*/
function ProjectForm(props) {
  const {
    createProject, onComplete, team, templates, hideType, onClose, open,
  } = props;

  const [loading, setLoading] = useState(false);
  const [newProject, setNewProject] = useState({});
  const [error, setError] = useState("");
  const [activeMenu, setActiveMenu] = useState("empty");
  const [createdProject, setCreatedProject] = useState(null);
  const modalSize = useMemo(() => {
    if (activeMenu === "template") return "5xl";
    return "md";
  }, [activeMenu]);

  const _onCreateProject = (noRedirect) => {
    setLoading(true);
    return createProject(newProject)
      .then((project) => {
        setLoading(false);
        setNewProject({});
        setCreatedProject(project);

        if (noRedirect) return project;

        return onComplete(project);
      })
      .catch((error) => {
        setLoading(false);
        setError(error);
      });
  };

  const _onCompleteTemplate = () => {
    setTimeout(() => {
      onComplete(createdProject, false);
    }, 1000);
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      closeButton
      size={modalSize}
    >
      <ModalContent>
        <ModalHeader>
          <Text size="h3">Create a new project</Text>
        </ModalHeader>
        <ModalBody>
          <form onSubmit={(e) => {
            e.preventDefault();
            _onCreateProject();
          }}>
            <div>
              <Spacer y={2} />
              {!hideType && (
                <Row align="center" justify="center">
                  <Tabs selectedKey={activeMenu} onSelectionChange={(key) => setActiveMenu(key)} fullWidth>
                    <Tab key="empty" id="empty" title="Empty project" />
                    <Tab key="template" id="template" title="From template" />
                  </Tabs>
                </Row>
              )}
              <Spacer y={4} />
              <Row align="center">
                <Input
                  onChange={(e) => setNewProject({
                    ...newProject,
                    name: e.target.value,
                    team_id: team.active.id,
                  })}
                  placeholder="Enter a name for your project"
                  fullWidth
                  size="lg"
                  variant="bordered"
                  autoFocus
                  value={newProject.name}
                />
              </Row>
              {error && (
                <Row>
                  <Text color="red">
                    {error}
                  </Text>
                </Row>
              )}
              <Spacer y={4} />
              {activeMenu === "empty" && (
                <>
                  <Spacer y={4} />
                  <Row align="center" justify="center">
                    <Button
                      isDisabled={!newProject.name}
                      onClick={() => _onCreateProject()}
                      endContent={<IoArrowForward />}
                      color="primary"
                      size="lg"
                      isLoading={loading}
                    >
                      {"Create"}
                    </Button>
                  </Row>
                </>
              )}
            </div>
          </form>

          {activeMenu === "template" && (
            <>
              <CustomTemplates
                templates={templates.data}
                loading={templates.loading}
                teamId={team.id}
                projectId={createdProject && createdProject.id}
                connections={[]}
                onComplete={_onCompleteTemplate}
                onCreateProject={() => _onCreateProject(true)}
              />
            </>
          )}
          <Spacer y={1} />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

ProjectForm.defaultProps = {
  onComplete: () => {},
  hideType: false,
};

ProjectForm.propTypes = {
  createProject: PropTypes.func.isRequired,
  onComplete: PropTypes.func,
  team: PropTypes.object.isRequired,
  templates: PropTypes.object.isRequired,
  hideType: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  open: PropTypes.bool.isRequired,
};

const mapStateToProps = (state) => {
  return {
    team: state.team,
    templates: state.template
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    createProject: data => dispatch(createProject(data)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(ProjectForm);
