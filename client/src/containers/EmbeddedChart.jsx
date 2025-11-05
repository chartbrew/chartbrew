import React, { useState, useEffect, useRef } from "react";
import {
  Popover, Link, Spacer, CircularProgress, PopoverTrigger, PopoverContent,
  Spinner,
  Alert,
} from "@heroui/react";
import moment from "moment";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router";
import { LuListFilter } from "react-icons/lu";
import { useParams } from "react-router";
import { useDispatch } from "react-redux";

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
import KpiMode from "./Chart/components/KpiMode";
import useChartSize from "../modules/useChartSize";
import { useTheme } from "../modules/ThemeContext";

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
  const [isSnapshot, setIsSnapshot] = useState(false);
  const [showChart, setShowChart] = useState(false);

  const params = useParams();
  const dispatch = useDispatch();
  const { setTheme } = useTheme();
  const [searchParams] = useSearchParams();
  const filterRef = useRef(null);
  const chartSize = useChartSize(chart?.layout);
  
  useInterval(() => {
    setDataLoading(true);
    
    // Extract all query parameters to pass to the backend
    const allQueryParams = {};
    searchParams.forEach((value, key) => {
      allQueryParams[key] = value;
    });
    
    // We pass all query parameters so the backend can process variables based on the share policy
    dispatch(getEmbeddedChart({ 
      embed_id: params.chartId, 
      token: searchParams.get("token"),
      queryParams: allQueryParams
    }))
      .then((chart) => {
        if (chart?.error) {
          setError(true);
          setChart({ error: "no chart" });
        } else {
          setChart(chart.payload);
        }

        setDataLoading(false);
      })
      .catch(() => {
        setError(true);
        setChart({ error: "no chart" });
        setDataLoading(false);
      });
  }, chart?.autoUpdate > 0 && chart.autoUpdate < 600 ? chart.autoUpdate * 1000 : 600000);

  useEffect(() => {
    // change the background color to transparent
    document.body.style.backgroundColor = "transparent";

    const urlParams = new URLSearchParams(document.location.search);

    setIsSnapshot(urlParams.has("isSnapshot"));

    setLoading(true);
    setTimeout(() => {
      // Extract all query parameters to pass to the backend
      const allQueryParams = {};
      searchParams.forEach((value, key) => {
        allQueryParams[key] = value;
      });
      
      // The backend now handles all variable filtering based on the share policy
      dispatch(getEmbeddedChart({ 
        embed_id: params.chartId, 
        snapshot: urlParams.has("isSnapshot"), 
        token: searchParams.get("token"),
        queryParams: allQueryParams
      }))
        .then((chart) => {
          if (chart?.error) {
            setError(true);
            setChart({ error: "no chart" });
          } else {
            setChart(chart.payload);
          }
          setLoading(false);
        })
        .catch(() => {
          setError(true);
          setLoading(false);
          setChart({ error: "no chart" });
        });
    }, 1000);

    if (searchParams.get("theme") === "light" || searchParams.get("theme") === "dark") {
      setTheme(searchParams.get("theme"));
    } else {
      setTheme("system");
    }
  }, []);

  useEffect(() => {
    // With the new share policy implementation, we just need to show the chart
    // The backend handles all variable filtering
    if (chart?.id && !filterRef.current) {
      filterRef.current = true;
      setShowChart(true);
    }
  }, [chart]);

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
    await dispatch(runQueryWithFilters({ 
      project_id: chart.project_id, 
      chart_id: chart.id, 
      filters: newConditions,
    }))
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
    dispatch(runQueryWithFilters({ 
      project_id: chart.project_id, 
      chart_id: chart.id, 
      filters: newConditions,
    }))
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

  if ((loading || !chart || !showChart) && !error) {
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
            <Spinner variant="simple" aria-label="Loading chart" />
          </Row>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <div className="p-2">
        <Alert
          title={"Chart cannot be loaded"}
          description="The chart might be private or the link expired."
        />
      </div>
    );
  }

  return (
    <div style={styles.container} id="chart-container">
      <Helmet>
        <title>
          {chart.name || "Chartbrew chart"}
        </title>
        <meta name="robots" content="noindex" />
        <meta name="og:title" content={chart.name || "Chartbrew chart"} />
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
              {!dataLoading && !isSnapshot && (
                <>
                  <span className="text-[10px] text-default-500" title="Last updated">{`${_getUpdatedTime(chart)}`}</span>
                </>
              )}
              {dataLoading && !isSnapshot && (
                <>
                  <CircularProgress classNames={{ svg: "w-4 h-4" }} aria-label="Updating chart" />
                  <Spacer x={1} />
                  <span className="text-[10px] text-default-500">{"Updating..."}</span>
                </>
              )}
            </div>
          </div>

          {chart.chartData && !isSnapshot && (
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
              defaultRowsPerPage={chart.defaultRowsPerPage}
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
