import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import toast from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import {
  Button, Chip, Divider, Spacer,
} from "@heroui/react";
import { LuListFilter, LuRefreshCw, LuVariable } from "react-icons/lu";

import DatasetFilters from "../../components/DatasetFilters";
import { runRequest } from "../../slices/dataset";
import { selectTeam } from "../../slices/team";
import { buildDatasetFieldOptions } from "../../modules/datasetFieldMetadata";
import QueryResultsTable from "../AddChart/components/QueryResultsTable";

function DatasetReusableSettings({ dataset, onUpdate }) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const dispatch = useDispatch();
  const team = useSelector(selectTeam);
  const datasetResponse = useSelector((state) => (
    state.dataset.responses.find((response) => response.dataset_id === dataset?.id)?.data
  ));

  const fieldOptions = useMemo(() => buildDatasetFieldOptions(dataset), [dataset]);

  const variableNames = useMemo(() => {
    const names = new Set();

    (dataset?.VariableBindings || []).forEach((variable) => {
      if (variable?.name) {
        names.add(variable.name);
      }
    });

    (dataset?.DataRequests || []).forEach((request) => {
      (request?.VariableBindings || []).forEach((variable) => {
        if (variable?.name) {
          names.add(variable.name);
        }
      });
    });

    return [...names];
  }, [dataset]);

  const _onRefreshPreview = async () => {
    if (!team?.id || !dataset?.id) {
      return;
    }

    setIsRefreshing(true);
    try {
      await dispatch(runRequest({
        team_id: team.id,
        dataset_id: dataset.id,
        getCache: false,
      })).unwrap();
      toast.success("Dataset preview refreshed");
    } catch (error) {
      toast.error("Could not refresh dataset preview");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="grid grid-cols-12 gap-4 mt-4">
      <div className="col-span-12 lg:col-span-5">
        <div className="bg-content1 rounded-lg border-1 border-divider p-4">
          <div className="flex flex-row items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">Reusable filters</div>
              <div className="text-sm text-default-500">
                Define dataset-level filters that can be reused across multiple charts.
              </div>
            </div>
            <Chip variant="flat" color="primary" startContent={<LuListFilter size={14} />}>
              {`${dataset?.conditions?.length || 0} filters`}
            </Chip>
          </div>

          <Spacer y={4} />
          <DatasetFilters
            onUpdate={onUpdate}
            fieldOptions={fieldOptions}
            dataset={dataset}
          />

          <Spacer y={4} />
          <Divider />
          <Spacer y={4} />

          <div className="flex flex-row items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">Variables</div>
              <div className="text-sm text-default-500">
                Variables are still configured on the dataset and request layers and stay reusable across charts.
              </div>
            </div>
            <Chip variant="flat" startContent={<LuVariable size={14} />}>
              {`${variableNames.length} variables`}
            </Chip>
          </div>

          <Spacer y={3} />
          <div className="flex flex-row flex-wrap gap-2">
            {variableNames.length === 0 && (
              <div className="text-sm text-default-500">
                No variables configured yet. Add them from the request builders or dataset filter bindings.
              </div>
            )}
            {variableNames.map((name) => (
              <Chip key={name} variant="bordered" radius="sm">
                {name}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div className="col-span-12 lg:col-span-7">
        <div className="bg-content1 rounded-lg border-1 border-divider p-4">
          <div className="flex flex-row items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-lg font-semibold">Dataset preview</div>
              <div className="text-sm text-default-500">
                Review the latest dataset rows and refresh the preview after request changes.
              </div>
            </div>
            <Button
              variant="flat"
              color="primary"
              onPress={_onRefreshPreview}
              isLoading={isRefreshing}
              startContent={!isRefreshing ? <LuRefreshCw /> : null}
            >
              Refresh preview
            </Button>
          </div>

          <Spacer y={4} />
          <QueryResultsTable result={datasetResponse ? JSON.stringify(datasetResponse) : ""} />
        </div>
      </div>
    </div>
  );
}

DatasetReusableSettings.propTypes = {
  dataset: PropTypes.object.isRequired,
  onUpdate: PropTypes.func.isRequired,
};

export default DatasetReusableSettings;
