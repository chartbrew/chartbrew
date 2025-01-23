import React, { Fragment } from "react";
import PropTypes from "prop-types";
import {
  Chip, Checkbox, Popover, Spacer, PopoverTrigger, PopoverContent,
} from "@heroui/react";
import { SketchPicker } from "react-color";

import { primary, chartColors } from "../../../config/colors";
import Text from "../../../components/Text";
import Row from "../../../components/Row";

function DatasetAppearance(props) {
  const {
    chart, dataItems, onUpdate, dataset,
  } = props;

  return (
    <div className="grid grid-cols-12 gap-2">
      <div className="col-span-12 md:col-span-6">
        <Text>Dataset Color</Text>
        <div>
          <Popover>
            <PopoverTrigger>
              <Chip
                style={styles.datasetColorBtn(dataset.datasetColor)}
                size="lg"
                radius="sm"
              >
                Click to select
              </Chip>
            </PopoverTrigger>
            <PopoverContent>
              <ColorPicker type="dataset" onUpdate={onUpdate} dataset={dataset} />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="col-span-12 md:col-span-6">
        <Text>Fill Color</Text>
        {chart.type !== "line" && (
          <div>
            <Checkbox
              isSelected={dataset.multiFill || false}
              onChange={(checked) => {
                onUpdate({ ...dataset, multiFill: checked });
              }}
              label="Multiple colors"
              size="sm"
            >
              Multiple colors
            </Checkbox>
            <Spacer y={1} />
          </div>
        )}
        <div>
          {(!dataset.multiFill || chart.type === "line") && (
            <Row align="center">
              <Popover
                style={{ padding: 0, margin: 0 }}
                className="p-0 m-0"
                placement="right"
              >
                <PopoverTrigger>
                  <Chip
                    style={styles.datasetColorBtn(dataset.fillColor)}
                    size="lg"
                    radius="sm"
                  >
                    Click to select
                  </Chip>
                </PopoverTrigger>
                <PopoverContent>
                  <ColorPicker type="fill" onUpdate={onUpdate} dataset={dataset} />
                </PopoverContent>
              </Popover>
              <Spacer x={0.5} />
              <Checkbox
                isSelected={dataset.fill || false}
                onChange={(checked) => {
                  onUpdate({ ...dataset, fill: checked });
                }}
                className="ml-10 align-middle"
              />
            </Row>
          )}
          <Spacer y={0.5} />
          {dataset.multiFill && chart.type !== "line" && (
            <div style={{ ...styles.row, flexWrap: "wrap" }}>
              {dataItems && dataItems.data && dataItems.data.map((val, fillIndex) => {
                return (
                  <Fragment key={dataItems && dataItems.labels[fillIndex]}>
                    <Popover>
                      <PopoverTrigger>
                        <Chip
                          style={styles.datasetColorBtn(dataset.fillColor[fillIndex])}
                          size="lg"
                          radius="sm"
                        >
                          {dataItems && dataItems.labels[fillIndex]}
                        </Chip>
                      </PopoverTrigger>
                      <PopoverContent>
                        <ColorPicker type="fill" fillIndex={fillIndex} onUpdate={onUpdate} dataset={dataset} />
                      </PopoverContent>
                    </Popover>
                    <Spacer x={0.3} />
                  </Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  datasetColorBtn: (datasetColor) => ({
    cursor: "pointer",
    backgroundColor: datasetColor === "rgba(0,0,0,0)" ? primary : datasetColor,
    border: `1px solid ${primary}`
  }),
  row: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
  },
};

DatasetAppearance.propTypes = {
  chart: PropTypes.object.isRequired,
  dataItems: PropTypes.array.isRequired,
  onUpdate: PropTypes.func.isRequired,
  dataset: PropTypes.object.isRequired,
};

function ColorPicker(props) {
  const {
    fillIndex, type, dataset, onUpdate
  } = props;
  let color = type === "dataset" ? dataset.datasetColor
    : (fillIndex || fillIndex === 0)
      ? dataset.fillColor[fillIndex] : dataset.fillColor;

  if (!dataset.datasetColor && type === "dataset") {
    color = chartColors[Math.floor(Math.random() * chartColors.length)];
  }

  return (
    <SketchPicker
      color={color}
      onChangeComplete={(color) => {
        const rgba = `rgba(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}, ${color.rgb.a})`;

        if (type === "dataset") {
          onUpdate({ ...dataset, datasetColor: rgba });
        }

        if (type === "fill") {
          if (!fillIndex && fillIndex !== 0) {
            onUpdate({ ...dataset, fillColor: rgba });
          } else {
            const { fillColor } = dataset;
            if (Array.isArray(fillColor) && fillColor[fillIndex]) {
              fillColor[fillIndex] = rgba;
            }
            onUpdate({ ...dataset, fillColor }, true);
          }
        }
      }}
    />
  );
}

ColorPicker.defaultProps = {
  fillIndex: null,
};

ColorPicker.propTypes = {
  dataset: PropTypes.object.isRequired,
  type: PropTypes.string.isRequired,
  fillIndex: PropTypes.oneOfType([PropTypes.number, PropTypes.object]),
  onUpdate: PropTypes.func.isRequired,
};

export default DatasetAppearance;
