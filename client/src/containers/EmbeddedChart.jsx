import React, { useState, useEffect, useRef } from "react";
import {
  Popover, Link, Spacer, CircularProgress, PopoverTrigger, PopoverContent,
} from "@nextui-org/react";
import moment from "moment";
import { Helmet } from "react-helmet";
import useDarkMode from "@fisch0920/use-dark-mode";
import { useSearchParams } from "react-router-dom";
import { LuListFilter } from "react-icons/lu";
import { useParams } from "react-router";
import { useDispatch } from "react-redux";
import { useLocalStorage } from "react-use";

import {
  getEmbeddedChart, runQueryWithFilters,
} from "../slices/chart";
import LineChart from "./Chart/components/LineChart";
import BarChart from "./Chart/components/BarChart";
import TableContainer from "./Chart/components/TableView/TableContainer";
import ChartFilters from "./Chart/components/ChartFilters";
import PieChart from "./Chart/components/PieChart";
import DoughnutChart from "./Chart/components/DoughnutChart";
import RadarChart from "./Chart/components/RadarChart";
import PolarChart from "./Chart/components/PolarChart";
import useInterval from "../modules/useInterval";
import Row from "../components/Row";
import Text from "../components/Text";
import Callout from "../components/Callout";
import KpiMode from "./Chart/components/KpiMode";
import useChartSize from "../modules/useChartSize";

const pageHeight = window.innerHeight;

/*
  This container is used for embedding charts in other websites
*/
function EmbeddedChart() {
  const [loading, setLoading] = useState(false);
  const [chart, setChart] = useState({});
  const [error, setError] = useState(false);
  const [conditions, setConditions] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [redraw, setRedraw] = useState(true);
  const [isOsTheme, setIsOsTheme] = useLocalStorage("osTheme", "false"); // eslint-disable-line

  const params = useParams();
  const dispatch = useDispatch();
  const darkMode = useDarkMode(false);
  const [searchParams] = useSearchParams();
  const filterRef = useRef(null);
  const chartSize = useChartSize(chart.layout);
  
  useInterval(() => {
    setDataLoading(true);
    dispatch(getEmbeddedChart({ embed_id: params.chartId }))
      .then((chart) => {
        setChart(chart.payload);
        setDataLoading(false);
      })
      .catch(() => {
        setDataLoading(false);
      });
  }, chart?.autoUpdate ? chart.autoUpdate * 1000 : null);

  useEffect(() => {
    // change the background color to transparent
    document.body.style.backgroundColor = "transparent";

    setLoading(true);
    setTimeout(() => {
      dispatch(getEmbeddedChart({ embed_id: params.chartId }))
        .then((chart) => {
          setChart(chart.payload);
          setLoading(false);
        })
        .catch(() => {
          setError(true);
          setLoading(false);
          setChart({ error: "no chart" });
        });
    }, 1000);

    if (searchParams.get("theme") && searchParams.get("theme") !== "os") {
      _setTheme(searchParams.get("theme"));
    } else {
      _setOSTheme();
    }
  }, []);

  useEffect(() => {
    // check the search params and pass them to
    if (chart.id && !filterRef.current) {
      filterRef.current = true;
      _checkSearchParamsForFilters();
    }
  }, [chart]);

  const _checkSearchParamsForFilters = () => {
    // check if there are any filters in the search params
    // if so, add them to the conditions
    const params = [];
    searchParams.entries().forEach((entry) => {
      const [key, value] = entry;
      params.push({ variable: key, value });
    });

    if (params.length === 0) return;

    let identifiedConditions = [];
    chart.ChartDatasetConfigs.forEach((cdc) => {
      if (Array.isArray(cdc.Dataset?.conditions)) {
        identifiedConditions = [...identifiedConditions, ...cdc.Dataset.conditions];
      }
    });

    // now check if any filters have the same variable name
    let newConditions = [];
    newConditions = identifiedConditions.map((c) => {
      const newCondition = c;
      const param = params.find((p) => p.variable === c.variable);
      if (param) {
        newCondition.value = param.value;
      }
      return newCondition;
    });

    // remove conditions that don't have a value
    newConditions = newConditions.filter((c) => c.value);

    if (newConditions.length === 0) return;

    dispatch(runQueryWithFilters({ project_id: chart.project_id, chart_id: chart.id, filters: newConditions }))
      .then((data) => {
        if (data.payload) {
          setChart(data.payload);
        }

        setDataLoading(false);
      })
      .catch(() => {
        setDataLoading(false);
      });
  };

  const _getUpdatedTime = (chart) => {
    const updatedAt = chart.chartDataUpdated || chart.lastAutoUpdate;
    if (moment().diff(moment(updatedAt), "days") > 1) {
      return moment(updatedAt).calendar();
    }

    return moment(updatedAt).fromNow();
  };

  const _onAddFilter = async (condition) => {
    let found = false;
    const newConditions = conditions.map((c) => {
      let newCondition = c;
      if (c.id === condition.id) {
        newCondition = condition;
        found = true;
      }
      return newCondition;
    });
    if (!found) newConditions.push(condition);
    setConditions(newConditions);

    setDataLoading(true);
    await dispatch(runQueryWithFilters({ project_id: chart.project_id, chart_id: chart.id, filters: newConditions }))
      .then((data) => {
        if (data.payload) {
          setChart(data.payload);
        }

        setDataLoading(false);
      })
      .catch(() => {
        setDataLoading(false);
      });
  };

  const _onClearFilter = (condition) => {
    const newConditions = [...conditions];
    let clearIndex;
    for (let i = 0; i < conditions.length; i++) {
      if (conditions[i].id === condition.id) {
        clearIndex = i;
        break;
      }
    }
    if (clearIndex > -1) newConditions.splice(clearIndex, 1);

    setConditions(newConditions);
    setDataLoading(true);
    dispatch(runQueryWithFilters({ project_id: chart.project_id, chart_id: chart.id, filters: newConditions }))
      .then((data) => {
        if (data.payload) {
          setChart(data.payload);
        }
        setDataLoading(false);
      });
  };

  const _checkIfFilters = () => {
    let filterCount = 0;
    chart.ChartDatasetConfigs.forEach((cdc) => {
      if (Array.isArray(cdc.Dataset?.conditions)) {
        filterCount += cdc.Dataset.conditions.filter((c) => c.exposed).length;
      }
    });

    return filterCount > 0;
  };

  const _setOSTheme = () => {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      darkMode.enable();
    } else {
      darkMode.disable();
    }

    window.localStorage.removeItem("darkMode");
    setIsOsTheme(true);
  };

  const _setTheme = (mode) => {
    setIsOsTheme(false);
    if (mode === "dark") {
      darkMode.enable();
    } else {
      darkMode.enable();
      setTimeout(() => {
        darkMode.disable();
      }, 100);
    }
  };

  if (loading) {
    return (
      <>
        <Helmet>
          <style type="text/css">
            {`
            body, html {
              background-color: transparent;
            }

            #root {
              background-color: transparent;
            }
          `}
          </style>
        </Helmet>
        <div className="container mx-auto pt-10">
          <Row justify="center" align="center">
            <CircularProgress color="default" />
          </Row>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <Callout
        title={"Error loading the chart"}
        text="The chart might not be public in the Chartbrew dashboard."
      />
    );
  }

  return (
    <div style={styles.container}>
      <Helmet>
        <style type="text/css">
          {`
            body, html {
              background-color: transparent;
            }

            #root {
              background-color: transparent;
            }
          `}
        </style>
      </Helmet>
      <div className="pl-unit-sm w-full" style={styles.header(chart.type)}>
        <Row justify="space-between">
          <div>
            <Text b>{chart.name}</Text>
            <div className="flex flex-row items-center">
              {!dataLoading && (
                <>
                  <span className="text-[10px] text-default-500" title="Last updated">{`${_getUpdatedTime(chart)}`}</span>
                </>
              )}
              {dataLoading && (
                <>
                  <CircularProgress classNames={{ svg: "w-4 h-4" }} />
                  <Spacer x={1} />
                  <span className="text-[10px] text-default-500">{"Updating..."}</span>
                </>
              )}
            </div>
          </div>

          {chart.chartData && (
            <div>
              {_checkIfFilters() && (
                <div className="flex items-start gap-1">
                  {chartSize?.[2] > 3 && (
                    <ChartFilters
                      chart={chart}
                      onAddFilter={_onAddFilter}
                      onClearFilter={_onClearFilter}
                      conditions={conditions}
                      inline
                      size="sm"
                      amount={1}
                    />
                  )}
                  <Popover>
                    <PopoverTrigger>
                      <Link className="text-gray-500">
                        <LuListFilter />
                      </Link>
                    </PopoverTrigger>
                    <PopoverContent className="pt-2">
                      <ChartFilters
                        chart={chart}
                        onAddFilter={_onAddFilter}
                        onClearFilter={_onClearFilter}
                        conditions={conditions}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          )}
        </Row>
      </div>
      <Spacer y={1} />
      {chart && (
        <div className="h-[calc(100vh-100px)]">
          {chart.type === "line" && (
            <LineChart
              chart={chart}
              redraw={redraw}
              redrawComplete={() => setRedraw(false)}
              embedded
            />
          )}
          {chart.type === "bar" && (
            <BarChart chart={chart} height={pageHeight - 100} />
          )}
          {chart.type === "pie" && (
            <PieChart
              chart={chart}
              height={pageHeight - 100}
            />
          )}
          {chart.type === "doughnut" && (
            <DoughnutChart
              chart={chart}
              height={pageHeight - 100}
            />
          )}
          {chart.type === "radar" && (
            <RadarChart
              chart={chart}
              height={pageHeight - 100}
            />
          )}
          {chart.type === "polar" && (
            <PolarChart
              chart={chart}
              height={pageHeight - 100}
            />
          )}
          {chart.type === "table" && (
            <TableContainer
              height={pageHeight - 100}
              tabularData={chart.chartData}
              embedded
              datasets={chart.ChartDatasetConfigs}
            />
          )}
          {(chart.type === "kpi" || chart.type === "avg") && (
            <KpiMode chart={chart} />
          )}
        </div>
      )}
      <Spacer y={2} />
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: "transparent",
    padding: 20,
  },
  header: (type) => ({
    paddingBottom: type === "table" ? 10 : 0,
  }),
  loaderContainer: {
    minHeight: 100,
    minWidth: 100,
  },
  updatedText: {
    paddingLeft: 20,
  },
  filterBtn: {
    // marginLeft: 10,
    backgroundColor: "transparent",
    boxShadow: "none",
  },
  row: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
  }
};

export default EmbeddedChart;
