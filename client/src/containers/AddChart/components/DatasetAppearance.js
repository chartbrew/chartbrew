import React, { Fragment } from "react";
import PropTypes from "prop-types";
import {
  Badge,
  Checkbox,
  Grid,
  Popover,
  Spacer,
  Text,
} from "@nextui-org/react";
import { SketchPicker } from "react-color";

import { primary, chartColors } from "../../../config/colors";

function DatasetAppearance(props) {
  const {
    chart, dataItems, onUpdate, dataset,
  } = props;

  return (
    <Grid.Container gap={1}>
      <Grid xs={12} sm={6} direction="column">
        <Text>Dataset Color</Text>
        <Popover>
          <Popover.Trigger>
            <Badge
              css={styles.datasetColorBtn(dataset.datasetColor)}
              size="lg"
              isSquared
            >
              Click to select
            </Badge>
          </Popover.Trigger>
          <Popover.Content>
            <ColorPicker type="dataset" onUpdate={onUpdate} dataset={dataset} />
          </Popover.Content>
        </Popover>
      </Grid>

      <Grid xs={12} sm={6} direction="column">
        <Text>Fill Color</Text>
        {chart.type !== "line" && (
          <>
            <Checkbox
              isSelected={dataset.multiFill || false}
              onChange={(checked) => {
                onUpdate({ ...dataset, multiFill: checked });
              }}
              label="Multiple colors"
              size="sm"
            />
            <Spacer y={0.5} />
          </>
        )}
        <div>
          {(!dataset.multiFill || chart.type === "line") && (
            <div style={styles.row}>
              <Popover
                style={{ padding: 0, margin: 0 }}
                on="click"
                position="right center"
              >
                <Popover.Trigger>
                  <Badge
                    style={styles.datasetColorBtn(dataset.fillColor)}
                    size="lg"
                    isSquared
                  >
                    Click to select
                  </Badge>
                </Popover.Trigger>
                <Popover.Content>
                  <ColorPicker type="fill" onUpdate={onUpdate} dataset={dataset} />
                </Popover.Content>
              </Popover>
              <Spacer x={0.2} />
              <Checkbox
                isSelected={dataset.fill || false}
                onChange={(checked) => {
                  onUpdate({ ...dataset, fill: checked });
                }}
                style={{ verticalAlign: "middle", marginLeft: 10 }}
              />
            </div>
          )}
          <Spacer y={0.5} />
          {dataset.multiFill && chart.type !== "line" && (
            <div style={{ ...styles.row, flexWrap: "wrap" }}>
              {dataItems && dataItems.data && dataItems.data.map((val, fillIndex) => {
                return (
                  <Fragment key={dataItems && dataItems.labels[fillIndex]}>
                    <Popover>
                      <Popover.Trigger>
                        <Badge
                          style={styles.datasetColorBtn(dataset.fillColor[fillIndex])}
                          size="lg"
                          isSquared
                        >
                          {dataItems && dataItems.labels[fillIndex]}
                        </Badge>
                      </Popover.Trigger>
                      <Popover.Content>
                        <ColorPicker type="fill" fillIndex={fillIndex} onUpdate={onUpdate} dataset={dataset} />
                      </Popover.Content>
                    </Popover>
                    <Spacer x={0.1} />
                  </Fragment>
                );
              })}
            </div>
          )}
        </div>
      </Grid>
    </Grid.Container>
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
