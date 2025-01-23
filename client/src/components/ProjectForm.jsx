import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import {
  Input, Button, Spacer, Modal, ModalHeader, ModalBody, ModalContent, Tabs, Tab, Card, CardBody, Image, CardFooter
} from "@heroui/react";
import { LuArrowRight } from "react-icons/lu";

import { createProject } from "../slices/project";
import { selectTeam } from "../slices/team";
import CustomTemplates from "../containers/Connections/CustomTemplates/CustomTemplates";
import Row from "./Row";
import Text from "./Text";
import availableTemplates from "../modules/availableTemplates";
import SimpleAnalyticsTemplate from "../containers/Connections/SimpleAnalytics/SimpleAnalyticsTemplate";
import { selectConnections } from "../slices/connection";
import ChartMogulTemplate from "../containers/Connections/ChartMogul/ChartMogulTemplate";
import MailgunTemplate from "../containers/Connections/Mailgun/MailgunTemplate";
import GaTemplate from "../containers/Connections/GoogleAnalytics/GaTemplate";
import PlausibleTemplate from "../containers/Connections/Plausible/PlausibleTemplate";

/*
  Contains the project creation functionality
*/
function ProjectForm(props) {
  const {
    onComplete = () => {},
    hideType = false,
    onClose,
    open,
  } = props;

  const [loading, setLoading] = useState(false);
  const [newProject, setNewProject] = useState({});
  const [error, setError] = useState("");
  const [activeMenu, setActiveMenu] = useState("empty");
  const [createdProject, setCreatedProject] = useState(null);
  const modalSize = useMemo(() => {
    if (activeMenu === "empty") return "xl";
    return "3xl";
  }, [activeMenu]);
  const [communityTemplate, setCommunityTemplate] = useState("");

  const team = useSelector(selectTeam);
  const connections = useSelector(selectConnections);

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
          <Text size="h3">Create a new dashboard</Text>
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
                  <Tabs selectedKey={activeMenu} onSelectionChange={(key) => setActiveMenu(key)} fullWidth isDisabled={!newProject.name}>
                    <Tab key="empty" id="empty" title="Empty dashboard" />
                    <Tab key="communityTemplates" title="Community templates" />
                    <Tab key="template" id="template" title="Custom templates" />
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
                  label="Dashboard name"
                  placeholder="Enter a name for your dashboard"
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

          {activeMenu === "communityTemplates" && (
            <>
              {communityTemplate === "" && (
                <>
                  <div className="grid grid-cols-12 gap-4">
                    {availableTemplates.map((t) => (
                      <div key={t.type} className="col-span-12 sm:col-span-6 md:col-span-4 lg:col-span-4">
                        <Card
                          isPressable
                          isHoverable
                          onClick={() => setCommunityTemplate(t.type)}
                          className="border-1 border-solid border-content3"
                        >
                          <CardBody className="p-0">
                            <Image className="object-cover" width="300" height="300" src={t.image} />
                          </CardBody>
                          <CardFooter>
                            <Row wrap="wrap" justify="center" align="center">
                              <span>
                                {t.name}
                              </span>
                            </Row>
                          </CardFooter>
                        </Card>
                      </div>
                    ))}
                  </div>
                  <Spacer y={4} />
                </>
              )}

              {communityTemplate === "saTemplate" && (
                <SimpleAnalyticsTemplate
                  projectName={newProject.name}
                  teamId={team.id}
                  onComplete={_onCompleteTemplate}
                  connections={connections}
                  onBack={() => setCommunityTemplate("")}
                />
              )}
              {communityTemplate === "cmTemplate" && (
                <ChartMogulTemplate
                  projectName={newProject.name}
                  teamId={team.id}
                  onComplete={_onCompleteTemplate}
                  connections={connections}
                  onBack={() => setCommunityTemplate("")}
                />
              )}
              {communityTemplate === "mailgunTemplate" && (
                <MailgunTemplate
                  projectName={newProject.name}
                  teamId={team.id}
                  onComplete={_onCompleteTemplate}
                  connections={connections}
                  onBack={() => setCommunityTemplate("")}
                />
              )}
              {communityTemplate === "googleAnalyticsTemplate" && (
                <GaTemplate
                  projectName={newProject.name}
                  teamId={team.id}
                  onComplete={_onCompleteTemplate}
                  connections={connections}
                  onBack={() => setCommunityTemplate("")}
                />
              )}
              {communityTemplate === "plausibleTemplate" && (
                <PlausibleTemplate
                  projectName={newProject.name}
                  teamId={team.id}
                  onComplete={_onCompleteTemplate}
                  connections={connections}
                  onBack={() => setCommunityTemplate("")}
                />
              )}
            </>
          )}


          {activeMenu === "template" && (
            <>
              <h3 className="font-semibold">{"Select a template"}</h3>
              <CustomTemplates
                teamId={team.id}
                projectId={createdProject && createdProject.id}
                connections={[]}
                onComplete={_onCompleteTemplate}
                onCreateProject={() => _onCreateProject(true)}
                isAdmin
              />
            </>
          )}
          <Spacer y={1} />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

ProjectForm.propTypes = {
  onComplete: PropTypes.func,
  hideType: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  open: PropTypes.bool.isRequired,
};

export default ProjectForm;
