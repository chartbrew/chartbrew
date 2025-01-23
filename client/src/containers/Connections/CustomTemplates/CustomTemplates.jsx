import React, { useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Card, Spacer, CircularProgress, CardHeader, CardBody, CardFooter, Divider,
} from "@heroui/react";
import moment from "moment";
import { LuChartColumn } from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";

import CreateTemplateForm from "../../../components/CreateTemplateForm";
import CustomTemplateForm from "./CustomTemplateForm";
import { deleteTemplate, selectTemplates } from "../../../slices/template";
import Text from "../../../components/Text";
import Row from "../../../components/Row";

function CustomTemplates(props) {
  const {
    teamId, projectId, onComplete, isAdmin,
    onCreateProject,
  } = props;

  const [createTemplate, setCreateTemplate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const dispatch = useDispatch();
  const templates = useSelector(selectTemplates);
  const loading = useSelector((state) => state.template.loading);

  const _getUpdatedTime = (updatedAt) => {
    if (moment().diff(moment(updatedAt), "hours") < 24) {
      return moment(updatedAt).calendar();
    }

    return moment(updatedAt).fromNow();
  };

  const _onDelete = (templateId) => {
    return dispatch(deleteTemplate({
      team_id: teamId,
      template_id: templateId
    }))
      .then(() => setSelectedTemplate(null));
  };

  if (loading) {
    return (
      <CircularProgress aria-label="Loading">
        Loading templates...
      </CircularProgress>
    );
  }

  if (templates.length === 0) {
    return (
      <div>
        <Row>
          <Text size="h4">No custom templates yet</Text>
        </Row>
        <Row>
          <Text>{"You can create custom templates from any project with data source connections and charts."}</Text>
        </Row>
        <Spacer y={1} />
        {projectId && (
          <Row>
            <Button
              color="primary"
              onClick={() => setCreateTemplate(true)}
            >
              Create a new template from this project
            </Button>
          </Row>
        )}

        <CreateTemplateForm
          teamId={teamId}
          projectId={projectId}
          visible={createTemplate}
          onClose={() => setCreateTemplate(false)}
        />
      </div>
    );
  }

  if (selectedTemplate) {
    return (
      <CustomTemplateForm
        template={selectedTemplate}
        onBack={() => setSelectedTemplate(null)}
        projectId={projectId}
        onComplete={onComplete}
        isAdmin={isAdmin}
        onDelete={(id) => _onDelete(id)}
        onCreateProject={onCreateProject}
      />
    );
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      {templates && templates.map((template) => (
        <div className="col-span-12 sm:col-span-12 md:col-span-6 lg:col-span-4" key={template.id}>
          <Card
            onClick={() => setSelectedTemplate(template)}
            isHoverable
            isPressable
            className="w-[230px] border-1 border-solid border-content3 h-full"
            shadow="none"
          >
            <CardHeader>
              <Text b>{template.name}</Text>
            </CardHeader>
            <Divider />
            <CardBody className="flex flex-col align-middle justify-center">
              <Row>
                <LuChartColumn />
                <Spacer x={0.5} />
                <Text>{`${template.model.Charts.length} charts`}</Text>
              </Row>
            </CardBody>
            <Divider />
            <CardFooter>
              <span className="text-sm">{`Updated ${_getUpdatedTime(template.updatedAt)}`}</span>
            </CardFooter>
          </Card>
        </div>
      ))}
    </div>
  );
}

CustomTemplates.propTypes = {
  templates: PropTypes.array.isRequired,
  loading: PropTypes.bool,
  teamId: PropTypes.string.isRequired,
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onComplete: PropTypes.func.isRequired,
  isAdmin: PropTypes.bool,
  onCreateProject: PropTypes.func,
};

CustomTemplates.defaultProps = {
  loading: false,
  isAdmin: false,
  projectId: "",
  onCreateProject: () => {},
};

export default CustomTemplates;
