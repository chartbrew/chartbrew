import React, { Fragment, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { connect, useDispatch, useSelector } from "react-redux";
import { LuExternalLink, LuPlus, LuSearch } from "react-icons/lu";
import { Link, useParams } from "react-router-dom";
import moment from "moment";

import { selectChart } from "../../../slices/chart";
import { Avatar, AvatarGroup, Button, Card, CardBody, CardFooter, CardHeader, Chip, Divider, Input, ScrollShadow, Spacer, Tab, Tabs } from "@nextui-org/react";
import Text from "../../../components/Text";
import Row from "../../../components/Row";
import connectionImages from "../../../config/connectionImages";
import { getDatasets, selectDatasets } from "../../../slices/dataset";
import useThemeDetector from "../../../modules/useThemeDetector";
import ChartDatasetConfig from "./ChartDatasetConfig";

function ChartDatasets(props) {
  const { projects, chartId } = props;

  const chart = useSelector((state) => selectChart(state, chartId));
  const datasets = useSelector(selectDatasets);

  const [datasetSearch, setDatasetSearch] = useState("");
  const [tag, setTag] = useState("project");
  const [addMode, setAddMode] = useState(false);
  const [activeCdc, setActiveCdc] = useState(null);

  const dispatch = useDispatch();
  const params = useParams();
  const isDark = useThemeDetector();

  useEffect(() => {
    if (!datasets || datasets.length === 0) {
      dispatch(getDatasets({ team_id: params.teamId }));
    }
  }, []);

  const _filteredDatasets = () => {
    if (tag === "project") {
      return datasets.filter((d) => d.legend.toLowerCase().includes(datasetSearch.toLowerCase()) && d.project_ids.includes(chart.project_id));
    }
    return datasets.filter((d) => d.legend.toLowerCase().includes(datasetSearch.toLowerCase()));
  };

  const _getDatasetTags = (dataset) => {
    const tags = [];
    if (!projects) return tags;
    dataset.project_ids.forEach((projectId) => {
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        tags.push(project.name);
      }
    });

    return tags;
  };

  return (
    <div>
      <Text size="h4">Datasets</Text>
      <Spacer y={4} />
      <Divider />
      <Spacer y={4} />

      {(chart.ChartDatasetConfigs?.length === 0 || addMode) && (
        <>
          <Input
            placeholder="Search datasets"
            value={datasetSearch}
            onChange={(e) => setDatasetSearch(e.target.value)}
            startContent={<LuSearch />}
            variant="bordered"
          />
          <Spacer y={2} />
          <Row align="center" className={"gap-1"}>
            <Chip
              color={tag === "project" ? "primary" : "default"}
              variant={tag === "project" ? "solid" : "bordered"}
              radius="sm"
              onClick={() => setTag("project")}
              className="cursor-pointer"
            >
              This project
            </Chip>
            <Chip
              color={tag === "team" ? "primary" : "default"}
              variant={tag === "team" ? "solid" : "bordered"}
              radius="sm"
              onClick={() => setTag("team")}
              className="cursor-pointer"
            >
              All
            </Chip>
            <Spacer x={1} />
            <Text size="sm">{`${_filteredDatasets().length} datasets found`}</Text>
          </Row>
          <Spacer y={4} />

          <ScrollShadow className="max-h-[500px] w-full">
            {datasets.length > 0 && _filteredDatasets().map((dataset) => (
              <Fragment key={dataset.id}>
                <Card isPressable isHoverable className="w-full shadow-none border-2 border-solid border-content3">
                  <CardHeader>
                    <div className={"flex flex-row justify-between gap-4 w-full"}>
                      <div className="flex flex-row gap-4 items-center justify-between w-full">
                        <div className="flex flex-col gap-1 items-start">
                          <Text b>{dataset.legend}</Text>
                          <div className="flex-wrap">
                            {_getDatasetTags(dataset).map((tag) => (
                              <Chip key={tag} radius="sm" size="sm" variant="faded">
                                {tag}
                              </Chip>
                            ))}
                          </div>
                        </div>
                        <AvatarGroup size="sm" isBordered>
                          {dataset?.DataRequests?.map((dr) => (
                            <Avatar
                              key={dr.id}
                              src={connectionImages(isDark)[dr?.Connection?.subType]}
                              isBordered
                            />
                          ))}
                        </AvatarGroup>
                      </div>                      
                    </div>
                  </CardHeader>
                  <Divider />
                  <CardBody className="p-2">
                    <div className="w-full flex flex-row justify-between">
                      <div>
                        <Text b size="sm">Metric: </Text>
                        <Text size="sm">{dataset.xAxis?.replace("root[].", "").replace("root.", "")}</Text>
                      </div>
                      <div>
                        <Text b size="sm">Dimension: </Text>
                        <Text size="sm">{dataset.xAxis?.replace("root[].", "").replace("root.", "")}</Text>
                      </div>
                    </div>
                  </CardBody>
                  <Divider />
                  <CardFooter className="justify-between">
                    <Text className={"text-[12px]"}>{`Created ${moment(dataset.createdAt).calendar()}`}</Text>
                    <div className="z-50">
                      <Button
                        className="z-50"
                        size="sm"
                        variant="ghost"
                        endContent={<LuExternalLink size={16} />}
                        as={Link}
                        to={`/chart/${chart.id}/dataset/${dataset.id}/edit`}
                        target="_blank"
                      >
                        Edit
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
                <Spacer y={2} />
              </Fragment>
            ))}
          </ScrollShadow>
          <Spacer y={8} />
        </>
      )}
      
      {chart?.ChartDatasetConfigs.length > 0 && (
        <div>
          <Row align={"center"}>
            <Tabs
              selectedKey={`${activeCdc}`}
              onSelectionChange={(key) => setActiveCdc(key)}
              fullWidth
            >
              {chart?.ChartDatasetConfigs.map((cdc) => (
                <Tab title={cdc.legend} key={cdc.id} />
              ))}
            </Tabs>
            <Spacer x={2} />
            <Button
              isIconOnly
              variant="faded"
              size="sm"
              onClick={() => setAddMode(!addMode)}
            >
              <LuPlus />
            </Button>
          </Row>
          <Spacer y={4} />
          <Divider />
          <Spacer y={4} />

          {activeCdc !== null && (
            <ChartDatasetConfig chartId={chartId} datasetId={activeCdc} />
          )}
          <Spacer y={2} />
        </div>
      )}
    </div>
  );
}

ChartDatasets.propTypes = {
  chartId: PropTypes.number.isRequired,
  projects: PropTypes.array.isRequired,
};

const mapStateToProps = (state) => ({
  projects: state.project.data,
});

const mapDispatchToProps = ({});

export default connect(mapStateToProps, mapDispatchToProps)(ChartDatasets);
