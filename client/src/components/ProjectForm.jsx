import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { connect, useDispatch, useSelector } from "react-redux";
import {
  Input, Button, Spacer, Modal, ModalHeader, ModalBody, ModalContent, Tabs, Tab
} from "@nextui-org/react";
import { LuArrowRight } from "react-icons/lu";

import { createProject } from "../slices/project";
import { selectTeam } from "../slices/team";
import CustomTemplates from "../containers/Connections/CustomTemplates/CustomTemplates";
import Row from "./Row";
import Text from "./Text";

/*
  Contains the project creation functionality
*/
function ProjectForm(props) {
  const {
    onComplete, templates, hideType, onClose, open,
  } = props;

  const [loading, setLoading] = useState(false);
  const [newProject, setNewProject] = useState({});
  const [error, setError] = useState("");
  const [activeMenu, setActiveMenu] = useState("empty");
  const [createdProject, setCreatedProject] = useState(null);
  const modalSize = useMemo(() => {
    if (activeMenu === "template") return "3xl";
    return "md";
  }, [activeMenu]);

  const team = useSelector(selectTeam);

  const dispatch = useDispatch();

  const _onCreateProject = (noRedirect) => {
    setLoading(true);
    return dispatch(createProject({ data: newProject }))
      .then((project) => {
        setLoading(false);
        setNewProject({});
        setCreatedProject(project.payload);

        if (noRedirect) return project.payload;

        return onComplete(project.payload);
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
      scrollBehavior="inside"
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
                    team_id: team.id,
                  })}
                  label="Project name"
                  placeholder="Enter a name for your project"
                  fullWidth
                  size="lg"
                  variant="bordered"
                  autoFocus
                  value={newProject.name}
                  color="primary"
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
                      endContent={<LuArrowRight />}
                      color="primary"
                      size="lg"
                      isLoading={loading}
                      fullWidth
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
              <h3 className="font-semibold text-gray-900">{"Select a template"}</h3>
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
  onComplete: PropTypes.func,
  templates: PropTypes.object.isRequired,
  hideType: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  open: PropTypes.bool.isRequired,
};

const mapStateToProps = (state) => {
  return {
    templates: state.template
  };
};

const mapDispatchToProps = () => {
  return {
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(ProjectForm);
