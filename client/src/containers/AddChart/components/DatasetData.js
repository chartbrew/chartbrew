import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Dropdown, Icon, Input, Button
} from "semantic-ui-react";

function DatasetData(props) {
  const { requestResult } = props;

  const [fieldOptions, setFieldOptions] = useState([]);
  const [selectedField, setSelectedField] = useState("");

  useEffect(() => {
    if (requestResult && requestResult.data && requestResult.data[0]) {
      const tempFieldOptions = [];
      Object.keys(requestResult.data[0]).forEach((field) => {
        tempFieldOptions.push({
          key: field,
          text: field,
          value: field,
        });
      });
      setFieldOptions(tempFieldOptions);
    }
  }, [requestResult]);

  const _selectField = (e, data) => {
    setSelectedField(data.value);
  };

  // if (!requestResult) {
  //   return (
  //     <div>
  //       <p><i> - Fetch some data first - </i></p>
  //     </div>
  //   );
  // }

  return (
    <div>
      <Dropdown
        button
        className="icon small button"
        floating
        labeled
        icon="calendar"
        options={fieldOptions}
        search
        text={selectedField || "Select a date field"}
        onChange={_selectField}
      />
      <div style={{ marginTop: 20 }}>
        <label>{"where "}</label>
        <Dropdown
          icon={null}
          className="small button"
          button
          options={fieldOptions}
          search
          text={"age"}
          onChange={_selectField}
        />
        <Dropdown
          icon={null}
          button
          className="small button"
          options={fieldOptions}
          search
          text={">"}
          onChange={_selectField}
        />
        <Input
          placeholder="Enter a value"
          size="small"
        />

        <Button icon basic style={{ boxShadow: "none" }}>
          <Icon name="plus" />
        </Button>
        {" "}

      </div>
    </div>
  );
}

DatasetData.propTypes = {
  requestResult: PropTypes.object.isRequired,
};

export default DatasetData;
