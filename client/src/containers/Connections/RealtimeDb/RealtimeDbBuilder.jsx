import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import {
  Button, Input, Spacer, Divider, Chip, Checkbox, Tooltip,
} from "@heroui/react";
import AceEditor from "react-ace";
import toast from "react-hot-toast";
import { LuInfo, LuPlay, LuTrash, LuX } from "react-icons/lu";
import { useParams } from "react-router";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import { getConnection } from "../../../slices/connection";
import Row from "../../../components/Row";
import Text from "../../../components/Text";
import { useTheme } from "../../../modules/ThemeContext";
import { runDataRequest, selectDataRequests } from "../../../slices/dataset";

/*
  The API Data Request builder
*/
function RealtimeDbBuilder(props) {
  const [firebaseRequest, setFirebaseRequest] = useState({
    route: "",
  });
  const [result, setResult] = useState("");
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [projectId, setProjectId] = useState("");
  const [limitValue, setLimitValue] = useState(100);
  const [invalidateCache, setInvalidateCache] = useState(false);
  const [fullConnection, setFullConnection] = useState({});
  const [saveLoading, setSaveLoading] = useState(false);

  const { isDark } = useTheme();
  const params = useParams();
  const dispatch = useDispatch();
  const stateDrs = useSelector((state) => selectDataRequests(state, params.datasetId));

  const {
    dataRequest, onChangeRequest, connection, onSave, onDelete,
  } = props;

  // on init effect
  useEffect(() => {
    if (dataRequest) {
      setFirebaseRequest(dataRequest);
      if (dataRequest?.configuration?.limitToLast) {
        setLimitValue(dataRequest.configuration.limitToLast);
      } else if (dataRequest?.configuration?.limitToFirst) {
        setLimitValue(dataRequest.configuration.limitToFirst);
      }
    }
  }, []);

  useEffect(() => {
    const newRequest = firebaseRequest;

    dispatch(getConnection({ team_id: params.teamId, connection_id: connection.id }))
      .then((data) => {
        setFullConnection(data.payload);
        if (data?.payload && data.payload?.firebaseServiceAccount) {
          try {
            setProjectId(JSON.parse(data.payload.firebaseServiceAccount).project_id);
          } catch (error) {
            //
          }
        }
      })
      .catch(() => {});

    onChangeRequest(newRequest);
  }, [firebaseRequest, connection]);

  useEffect(() => {
    if (stateDrs && stateDrs.length > 0) {
      const selectedResponse = stateDrs.find((o) => o.id === firebaseRequest.id);
      if (selectedResponse?.response) {
        setResult(JSON.stringify(selectedResponse.response, null, 2));
      }
    }
  }, [stateDrs, firebaseRequest]);

  const _onChangeRoute = (value) => {
    setFirebaseRequest({ ...firebaseRequest, route: value });
  };

  const _onTest = () => {
    setRequestLoading(true);
    setRequestSuccess(false);
    setRequestError("");

    onSave(firebaseRequest).then(() => {
      const getCache = !invalidateCache;
      dispatch(runDataRequest({
        team_id: params.teamId,
        dataset_id: firebaseRequest.dataset_id,
        dataRequest_id: firebaseRequest.id,
        getCache
      }))
        .then((data) => {
          if (data?.error) {
            setRequestLoading(false);
            setRequestError(data.error);
            toast.error("The request failed. Please check your request 🕵️‍♂️");
            setRequestError(data.error?.message || `${data.error}`);
            return;
          }

          const result = data.payload;
          if (result?.status?.statusCode >= 400) {
            setRequestError(result.response);
          }
          if (result?.response?.dataRequest?.responseData?.data) {
            setResult(JSON.stringify(result.response.dataRequest.responseData.data, null, 2));
            setRequestSuccess(result.status);
          }
          setRequestLoading(false);
        })
        .catch((error) => {
          setRequestLoading(false);
          setRequestError(error);
          toast.error("The request failed. Please check your request 🕵️‍♂️");
          setRequestError(error.message || `${error}`);
        });
    });
  };

  const _onChangeLimitValue = (value) => {
    setLimitValue(value);
    if (firebaseRequest.configuration && firebaseRequest.configuration.limitToLast) {
      setFirebaseRequest({
        ...firebaseRequest,
        configuration: {
          ...firebaseRequest.configuration,
          limitToLast: value,
        },
      });
    }

    if (firebaseRequest.configuration && firebaseRequest.configuration.limitToFirst) {
      setFirebaseRequest({
        ...firebaseRequest,
        configuration: {
          ...firebaseRequest.configuration,
          limitToFirst: value,
        },
      });
    }
  };

  const _onSavePressed = () => {
    setSaveLoading(true);
    onSave(firebaseRequest).then(() => {
      setSaveLoading(false);
    }).catch(() => {
      setSaveLoading(false);
    });
  };

  return (
    <div style={styles.container} className="pl-1 pr-1 md:pl-4 md:pr-4">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 sm:col-span-7">
          <Row justify="space-between" align="center">
            <Text b size={"lg"}>{connection.name}</Text>
            <div>
              <Row>
                <Button
                  color="primary"
                  size="sm"
                  onClick={() => _onSavePressed()}
                  isLoading={saveLoading || requestLoading}
                  variant="flat"
                >
                  {"Save"}
                </Button>
                <Spacer x={1} />
                <Tooltip content="Delete this data request" placement="bottom" css={{ zIndex: 99999 }}>
                  <Button
                    color="danger"
                    isIconOnly
                    size="sm"
                    variant="bordered"
                    onClick={() => onDelete()}
                  >
                    <LuTrash />
                  </Button>
                </Tooltip>
              </Row>
            </div>
          </Row>
          <Spacer y={2} />
          <Row>
            <Divider />
          </Row>
          <Spacer y={4} />
          <Row className="RealtimeDb-route-tut">
            <Input
              value={fullConnection.connectionString || `https://${projectId || "<your_project>"}.firebaseio.com/`}
              fullWidth
              className={"pointer-events-none"}
              labelPlacement="outside"
            />
            <Spacer x={1} />
            <Input
              placeholder={"Enter the data path"}
              autoFocus
              value={firebaseRequest.route || ""}
              onChange={(e) => _onChangeRoute(e.target.value)}
              variant="bordered"
              fullWidth
              disableAnimation
              labelPlacement="outside"
            />
          </Row>
          {(requestSuccess || requestError) && (
            <>
              <Spacer y={2} />
              <Row>
                {requestSuccess && requestSuccess.statusCode < 300 && (
                  <>
                    <Chip color="success">
                      {`${requestSuccess.statusCode} ${requestSuccess.statusText}`}
                    </Chip>
                    <Spacer x={0.5} />
                    <Chip>
                      {`Length: ${result ? JSON.parse(result).length : 0}`}
                    </Chip>
                  </>
                )}
                {requestSuccess?.statusCode > 300 && (
                  <Chip color="danger">
                    {`${requestSuccess.statusCode} ${requestSuccess.statusText}`}
                  </Chip>
                )}
              </Row>
            </>
          )}

          <Spacer y={2} />
          <Divider />
          <Spacer y={2} />

          <Row>
            <Text b>
              Order By
            </Text>
          </Row>
          <Spacer y={1} />
          <Row align="center" className={"gap-1"}>
            <Button
              variant={"bordered"}
              size="sm"
              color={!firebaseRequest.configuration || (firebaseRequest.configuration && firebaseRequest.configuration.orderBy !== "child") ? "default" : "secondary"}
              onClick={() => (
                setFirebaseRequest({
                  ...firebaseRequest,
                  configuration: {
                    ...firebaseRequest.configuration,
                    orderBy: "child"
                  }
                })
              )}
            >
              {"Child key"}
            </Button>
            <Button
              size="sm"
              variant="bordered"
              color={!firebaseRequest.configuration || (firebaseRequest.configuration && firebaseRequest.configuration.orderBy !== "key") ? "default" : "secondary"}
              onClick={() => (
                setFirebaseRequest({
                  ...firebaseRequest,
                  configuration: {
                    ...firebaseRequest.configuration,
                    orderBy: "key",
                  }
                })
              )}
            >
              {"Key"}
            </Button>
            <Button
              size="sm"
              variant={"bordered"}
              color={!firebaseRequest.configuration || (firebaseRequest.configuration && firebaseRequest.configuration.orderBy !== "value") ? "default" : "secondary"}
              onClick={() => (
                setFirebaseRequest({
                  ...firebaseRequest,
                  configuration: {
                    ...firebaseRequest.configuration,
                    orderBy: "value",
                  }
                })
              )}
            >
              {"Value"}
            </Button>
            {firebaseRequest.configuration && firebaseRequest.configuration.orderBy && (
              <>
                <Spacer x={0.1} />
                <Button
                  color="danger"
                  variant="light"
                  startContent={<LuX />}
                  onClick={() => (
                    setFirebaseRequest({
                      ...firebaseRequest,
                      configuration: {
                        ...firebaseRequest.configuration,
                        orderBy: ""
                      }
                    })
                  )}
                  size="sm"
                >
                  {"Disable ordering"}
                </Button>
              </>
            )}
          </Row>
          <Spacer y={1} />
          {firebaseRequest.configuration && firebaseRequest.configuration.orderBy === "child" && (
            <Row>
              <Input
                placeholder="Enter a field to order by"
                value={(firebaseRequest.configuration && firebaseRequest.configuration.key) || ""}
                onChange={(e) => (
                  setFirebaseRequest({
                    ...firebaseRequest,
                    configuration: {
                      ...firebaseRequest.configuration,
                      key: e.target.value
                    }
                  })
                )}
                variant="bordered"
                fullWidth
                labelPlacement="outside"
              />
            </Row>
          )}

          <Spacer y={2} />
          <Divider />
          <Spacer y={2} />

          <Row>
            <Text b>Limit results</Text>
          </Row>
          <Spacer y={1} />

          <Row align="center" className={"gap-1"}>
            <Button
              size="sm"
              variant={"bordered"}
              color={
                !firebaseRequest.configuration
                || (firebaseRequest.configuration && !firebaseRequest.configuration.limitToLast)
                  ? "default" : "secondary"
              }
              onClick={() => (
                setFirebaseRequest({
                  ...firebaseRequest,
                  configuration: {
                    ...firebaseRequest.configuration,
                    limitToLast: limitValue,
                    limitToFirst: 0,
                  }
                })
              )}
            >
              Limit to last
            </Button>
            <Button
              size="sm"
              variant={"bordered"}
              color={
                !firebaseRequest.configuration
                || (firebaseRequest.configuration && !firebaseRequest.configuration.limitToFirst)
                  ? "default" : "secondary"
              }
              onClick={() => (
                setFirebaseRequest({
                  ...firebaseRequest,
                  configuration: {
                    ...firebaseRequest.configuration,
                    limitToFirst: limitValue,
                    limitToLast: 0,
                  }
                })
              )}
            >
              Limit to first
            </Button>
            {firebaseRequest.configuration
              && (firebaseRequest.configuration.limitToLast
                || firebaseRequest.configuration.limitToFirst)
              && (
                <Button
                  startContent={<LuX />}
                  onClick={() => (
                    setFirebaseRequest({
                      ...firebaseRequest,
                      configuration: {
                        ...firebaseRequest.configuration,
                        limitToFirst: "",
                        limitToLast: "",
                      }
                    })
                  )}
                  variant="light"
                  color="danger"
                  size="sm"
                >
                  Disable limit
                </Button>
              )}
          </Row>
          <Spacer y={2} />
          <Row>
            <Input
              placeholder="How many records should return?"
              type="number"
              value={limitValue}
              onChange={(e) => e.target.value && _onChangeLimitValue(e.target.value)}
              disabled={
                !firebaseRequest.configuration
                  || (
                    !firebaseRequest.configuration.limitToLast
                    && !firebaseRequest.configuration.limitToFirst
                  )
              }
              variant="bordered"
              fullWidth
              labelPlacement="outside"
            />
          </Row>
        </div>
        <div className="col-span-12 sm:col-span-5">
          <Row className="RealtimeDb-request-tut">
            <Button
              color="primary"
              endContent={<LuPlay />}
              isLoading={requestLoading}
              onClick={() => _onTest()}
              fullWidth
            >
              Make the request
            </Button>
          </Row>
          <Spacer y={2} />
          <Row align="center">
            <Checkbox
              isSelected={!invalidateCache}
              onChange={() => setInvalidateCache(!invalidateCache)}
              size="sm"
            >
              Use cache
            </Checkbox>
            <Spacer x={1} />
            <Tooltip
              content="Use cache to avoid hitting the Firebase API every time you request data. The cache will be cleared when you change any of the settings."
              className="max-w-[600px]"
            >
              <div><LuInfo /></div>
            </Tooltip>
          </Row>
          <Spacer y={2} />
          <Row align="center">
            <div className="w-full">
              <AceEditor
                mode="json"
                theme={isDark ? "one_dark" : "tomorrow"}
                height="450px"
                width="none"
                value={requestError || result || ""}
                name="resultEditor"
                readOnly
                editorProps={{ $blockScrolling: false }}
                className="RealtimeDb-result-tut rounded-md border-1 border-solid border-content3"
              />
            </div>
          </Row>
          <Spacer y={2} />
          <Row align="center">
            <LuInfo />
            <Spacer x={1} />
            <Text size="sm">
              {"This is a preview and it might not show all data in order to keep things fast in the UI."}
            </Text>
          </Row>
        </div>
      </div>
    </div>
  );
}
const styles = {
  container: {
    flex: 1,
  },
};

RealtimeDbBuilder.defaultProps = {
  dataRequest: null,
};

RealtimeDbBuilder.propTypes = {
  connection: PropTypes.object.isRequired,
  onChangeRequest: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  dataRequest: PropTypes.object,
  onDelete: PropTypes.func.isRequired,
};

export default RealtimeDbBuilder;
