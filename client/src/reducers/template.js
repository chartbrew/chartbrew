import _ from "lodash";

import {
  ADD_TEMPLATE,
  ADD_TEMPLATE_FAILED,
  FETCH_TEMPLATES,
  FETCHING_TEMPLATES,
  REMOVE_TEMPLATE,
} from "../actions/template";

export default function template(state = {
  loading: false,
  error: false,
  data: [],
  active: {},
}, action) {
  switch (action.type) {
    case ADD_TEMPLATE:
      // look for existing project in the data array and replace it if it exists
      let indexFound = -1;
      for (let i = 0; i < state.data.length; i++) {
        if (state.data[i].id === parseInt(action.template.id, 10)) {
          indexFound = i;
          break;
        }
      }
      const newData = [...state.data];
      if (indexFound > -1) {
        newData[indexFound] = action.template;
      } else {
        newData.push(action.template);
      }
      return { ...state, loading: false, data: newData };
    case FETCH_TEMPLATES:
      return { ...state, loading: false, data: action.templates };
    case ADD_TEMPLATE_FAILED:
      return { ...state, loading: false, error: true };
    case FETCHING_TEMPLATES:
      return { ...state, loading: true, error: false };
    case REMOVE_TEMPLATE:
      const removeIndex = _.findIndex(state.data, { id: action.id });

      if (removeIndex === -1) return state;

      const tempData = [...state.data];
      tempData.splice(removeIndex, 1);
      return { ...state, data: tempData };
    default:
      return state;
  }
}
