import React, { Fragment, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { connect, useDispatch, useSelector } from "react-redux";
import { LuExternalLink, LuGripVertical, LuMinus, LuPlus, LuSearch } from "react-icons/lu";
import { Link, useNavigate } from "react-router";
import moment from "moment";

import { createCdc, runQuery, selectChart, updateCdc } from "../../../slices/chart";
import {
  Avatar, Button, Card, Chip, Separator, Input, ScrollShadow, Tooltip
} from "@heroui/react";
import connectionImages from "../../../config/connectionImages";
import { getDatasets, selectDatasetsNoDrafts } from "../../../slices/dataset";
import { useTheme } from "../../../modules/ThemeContext";
import ChartDatasetConfig from "./ChartDatasetConfig";
import DraggableList from "../../../components/DraggableList";
import { chartColors } from "../../../config/colors";
import { selectTeam } from "../../../slices/team";
import canAccess from "../../../config/canAccess";
import { selectProjects } from "../../../slices/project";
import getDatasetDisplayName from "../../../modules/getDatasetDisplayName";

function ChartDatasets(props) {
  const { chartId, user } = props;

  const chart = useSelector((state) => selectChart(state, chartId));
  const datasets = useSelector(selectDatasetsNoDrafts) || [];
  const projects = useSelector(selectProjects);

  const [datasetSearch, setDatasetSearch] = useState("");
  const [tag, setTag] = useState("project");
  const [addMode, setAddMode] = useState(false);
  const [activeCdc, setActiveCdc] = useState(null);

  const dispatch = useDispatch();
  const { isDark } = useTheme();
  const team = useSelector(selectTeam);
  const navigate = useNavigate();

  const initRef = useRef(null);
  const datasetsRef = useRef(null);

  useEffect(() => {
    if ((!datasets || datasets.length === 0) && !datasetsRef.current && team?.id) {
      datasetsRef.current = true;
      dispatch(getDatasets({ team_id: team.id }));
    }
  }, [team]);

  useEffect(() => {
    if (datasets?.length > 0 && !initRef.current && chart) {
      initRef.current = true;
      const projectDatasets = datasets.filter((d) => (
        !d.draft
        && getDatasetDisplayName(d)?.toLowerCase().includes(datasetSearch?.toLowerCase())
        && d.project_ids?.includes(chart.project_id)
      ));
      if (projectDatasets.length === 0) {
        setTag("team");
      }
    }
  }, [datasets]);

  useEffect(() => {
    if (chart?.ChartDatasetConfigs?.length > 0 && !activeCdc?.id) {
      setActiveCdc(chart?.ChartDatasetConfigs[0]);
    }
  }, [chart]);


  const _filteredDatasets = () => {
    if (tag === "project") {
      return datasets.filter((d) => (
        !d.draft
        && getDatasetDisplayName(d)?.toLowerCase().includes(datasetSearch.toLowerCase())
        && d?.project_ids?.includes(chart.project_id)
      ));
    }
    return datasets.filter((d) => !d.draft && getDatasetDisplayName(d)?.toLowerCase().includes(datasetSearch.toLowerCase()));
  };

  const _getDatasetTags = (dataset) => {
    const tags = [];
    if (!projects) return tags;
    dataset.project_ids?.forEach((projectId) => {
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        tags.push(project.name);
      }
    });

    return tags;
  };

  const _onCreateCdc = (datasetId) => {
    const selectedDataset = datasets.find((dataset) => dataset.id === datasetId);
    // find out the perfect color for the new cdc
    const existingColors = chart.ChartDatasetConfigs.map((cdc) => cdc.datasetColor.toLowerCase());
    const newColor = Object.values(chartColors).find((color) => !existingColors.includes(color.hex.toLowerCase()) && !existingColors.includes(color.rgb))
      || chartColors.blue;

    dispatch(createCdc({
      project_id: chart.project_id,
      chart_id: chart.id,
      data: {
        dataset_id: datasetId,
        legend: getDatasetDisplayName(selectedDataset),
        datasetColor: newColor.hex,
        fill: false,
        order: chart.ChartDatasetConfigs[chart.ChartDatasetConfigs.length - 1]?.order + 1 || 0,
      },
    }))
      .then((res) => {
        setActiveCdc(res.payload);
        dispatch(runQuery({
          project_id: chart.project_id,
          chart_id: chart.id,
          noSource: false,
          skipParsing: false,
          getCache: true,
        }));
      });
    
    setAddMode(false);
  };

  const _onRemoveCdc = (cdcId) => {
    const newSelectedCdc = chart.ChartDatasetConfigs.find((c) => c.id !== cdcId);
    if (newSelectedCdc) {
      setActiveCdc(newSelectedCdc);
    } else {
      setActiveCdc(null);
    }
  };

  const _onReorderCdc = async ({ dragId, newOrder }) => {
    const dragged = chart.ChartDatasetConfigs.find((c) => c.id === dragId);
    if (dragged && newOrder !== dragged.order) {
      await dispatch(updateCdc({
        project_id: chart.project_id,
        chart_id: chart.id,
        cdc_id: dragged.id,
        data: { order: newOrder },
      }));

      _refreshChart();
    }
  };

  const _refreshChart = () => {
    dispatch(runQuery({
      project_id: chart.project_id,
      chart_id: chart.id,
      noSource: false,
      skipParsing: false,
      getCache: true,
    }));
  };

  return (
    <div>
      <div className="flex flex-row justify-between items-center">
        <div className="font-bold">Chart Series</div>
        <div className="flex flex-row gap-1 items-center">
          {canAccess("teamAdmin", user.id, team?.TeamRoles) && addMode && (
            <Button
              size="sm"
              variant="primary"
              onPress={() => navigate(`/datasets/new?create=true&project_id=${chart.project_id}&chart_id=${chart.id}`)}
            >
              Create new dataset
            </Button>
          )}

          {datasets.length > 0 && chart?.ChartDatasetConfigs.length > 0 && (
            <Button
              isIconOnly={addMode}
              variant="tertiary"
              size="sm"
              onPress={() => setAddMode(!addMode)}
              className="chart-cdc-add"
              startContent={!addMode ? <LuPlus /> : null}
            >
              {!addMode && "Add series"}
              {addMode && <LuMinus />}
            </Button>
          )}
        </div>
      </div>
      <div className="h-8" />

      {(chart?.ChartDatasetConfigs?.length === 0 || addMode) && (
        <>
          <Input
            placeholder="Search datasets"
            value={datasetSearch}
            onChange={(e) => setDatasetSearch(e.target.value)}
            startContent={<LuSearch />}
          />
          <div className="h-4" />
          <div className="flex flex-row gap-1 items-center">
            <Chip
              variant={tag === "project" ? "primary" : "soft"}
              onClick={() => setTag("project")}
              className="rounded-sm cursor-pointer"
            >
              This project
            </Chip>
            <Chip
              variant={tag === "team" ? "primary" : "soft"}
              onClick={() => setTag("team")}
              className="rounded-sm cursor-pointer chart-empty-filter-tutorial"
            >
              All
            </Chip>
            <div className="w-2" />
            <div className="text-sm text-foreground-500">{`${_filteredDatasets().length} datasets found`}</div>
          </div>
          <div className="h-8" />

          {datasets.length === 0 && (
            <div>No datasets available.</div>
          )}

          <ScrollShadow className="max-h-[500px] w-full">
            {datasets.length > 0 && _filteredDatasets().map((dataset, index) => (
              <Fragment key={dataset.id}>
                <Card
                  role="button"
                  tabIndex={0}
                  className={`w-full cursor-pointer border-2 border-solid border-content3 shadow-none transition-colors hover:bg-content2/40 ${index === 0 ? "chart-empty-select-tutorial" : ""}`}
                  onClick={() => _onCreateCdc(dataset.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      _onCreateCdc(dataset.id);
                    }
                  }}
                >
                  <Card.Header>
                    <div className={"flex flex-row justify-between gap-4 w-full"}>
                      <div className="flex flex-row gap-4 items-center justify-between w-full">
                        <div className="flex flex-col gap-1 items-start">
                          <div className="font-bold">{getDatasetDisplayName(dataset)}</div>
                          <div className="flex flex-wrap gap-1">
                            {_getDatasetTags(dataset).map((tag) => (
                              <Chip key={tag} size="sm" variant="primary">
                                {tag}
                              </Chip>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-row items-center gap-1">
                          {dataset?.DataRequests?.map((dr) => (
                            <Tooltip key={dr.id}>
                              <Tooltip.Trigger>
                                <Avatar
                                  size="sm"
                                  className="ring-2 ring-primary shrink-0"
                                >
                                  <Avatar.Image
                                    src={connectionImages(isDark)[dr?.Connection?.subType]}
                                    alt=""
                                  />
                                  <Avatar.Fallback />
                                </Avatar>
                              </Tooltip.Trigger>
                              <Tooltip.Content>
                                {dr?.Connection?.name}
                              </Tooltip.Content>
                            </Tooltip>
                          ))}
                        </div>
                      </div>                      
                    </div>
                  </Card.Header>
                  <Separator />
                  <Card.Footer className="justify-between">
                    <div className="text-xs text-foreground-500">{`Created ${moment(dataset.createdAt).calendar()}`}</div>
                    {canAccess("teamAdmin", user.id, team?.TeamRoles) && (
                      <div className="z-50">
                        <Button
                          className="z-50"
                          size="sm"
                          variant="ghost"
                          endContent={<LuExternalLink size={16} />}
                          as={Link}
                          to={`/datasets/${dataset.id}`}
                          target="_blank"
                        >
                          Edit
                        </Button>
                      </div>
                    )}
                  </Card.Footer>
                </Card>
                <div className="h-4" />
              </Fragment>
            ))}
          </ScrollShadow>
          <div className="h-16" />
        </>
      )}

      {datasets.length === 0 && canAccess("teamAdmin", user.id, team?.TeamRoles) && (
        <div>
          <div className="h-8" />
          <Separator />
          <div className="h-8" />
          <div className="text-sm text-foreground-500">No datasets found. Create a dataset to get started.</div>
          <div className="h-8" />
          <Button
            variant="primary"
            onPress={() => navigate(`/datasets/new?create=true&project_id=${chart.project_id}&chart_id=${chart.id}`)}
            fullWidth
          >
            Create series
          </Button>
        </div>
      )}

      {chart?.ChartDatasetConfigs.length > 0 && (
        <DraggableList
          items={chart.ChartDatasetConfigs}
          getId={(item) => item.id}
          getOrder={(item) => item.order}
          onReorder={({ dragId, newOrder }) => {
            _onReorderCdc({ dragId, newOrder });
          }}
          orientation="horizontal"
          renderItem={(cdc, { isDragging }) => (
            <Chip
              key={cdc.id}
              title={`${cdc.legend || getDatasetDisplayName(datasets.find((dataset) => dataset.id === cdc.dataset_id))}`}
              variant={activeCdc?.id === cdc.id ? "primary" : "soft"}
              onClick={() => setActiveCdc(cdc)}
              className={`rounded-sm cursor-pointer select-none ${isDragging ? "cursor-grab" : ""}`}
              size="lg"
              endContent={<LuGripVertical size={16} className="cursor-grab" />}
              startContent={(
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cdc.datasetColor }} />
              )}
            >
              {cdc.legend || getDatasetDisplayName(datasets.find((dataset) => dataset.id === cdc.dataset_id))}
            </Chip>
          )}
        />
      )}

      <div className="h-8" />
      <Separator />
      <div className="h-8" />

      {activeCdc?.id && (
        <ChartDatasetConfig
          chartId={chartId}
          cdcId={activeCdc.id}
          dataRequests={datasets.find((d) => d.id === activeCdc.dataset_id)?.DataRequests}
          onRemove={(cdcId) => _onRemoveCdc(cdcId)}
        />
      )}
    </div>
  );
}

ChartDatasets.propTypes = {
  chartId: PropTypes.number.isRequired,
  user: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => ({
  user: state.user.data,
});

const mapDispatchToProps = ({});

export default connect(mapStateToProps, mapDispatchToProps)(ChartDatasets);
