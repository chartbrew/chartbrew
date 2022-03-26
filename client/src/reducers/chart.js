import {
  FETCH_CHART,
  FETCH_CHART_FAIL,
  FETCH_CHART_SUCCESS,
  FETCH_ALL_CHARTS,
  UPDATE_CHART_FIELDS
} from "../actions/chart";

export default function chart(state = {
  loading: false,
  error: false,
  data: [],
}, action) {
  switch (action.type) {
    case FETCH_CHART:
      if (action.chartId) {
        const newData = [...state.data];
        let indexFound = false;
        for (let i = 0; i < state.data.length; i++) {
          if (state.data[i].id === parseInt(action.chartId, 10)) {
            indexFound = i;
          }
        }

        if (indexFound) newData[indexFound].loading = true;

        return { ...state, data: newData, loading: true };
      } else {
        return { ...state, loading: true };
      }
    case FETCH_ALL_CHARTS:
      return { ...state, loading: false, data: action.charts };
    case FETCH_CHART_SUCCESS:
      // look for existing chart in the data array and replace it if it exists
      let indexFound = -1;
      for (let i = 0; i < state.data.length; i++) {
        if (state.data[i].id === parseInt(action.chart.id, 10)) {
          indexFound = i;
          break;
        }
      }
      const newData = [...state.data];
      if (indexFound > -1) {
        newData[indexFound] = { ...newData[indexFound], ...action.chart, loading: false };
      } else {
        newData.push(action.chart);
      }
      return { ...state, loading: false, data: newData };
    case UPDATE_CHART_FIELDS:
      // look for existing chart in the data array and replace it if it exists
      let indexUpdate = -1;
      for (let i = 0; i < state.data.length; i++) {
        if (state.data[i].id === parseInt(action.chart.id, 10)) {
          indexUpdate = i;
          break;
        }
      }
      const updateData = [...state.data];
      if (indexUpdate > -1) {
        updateData[indexUpdate] = { ...updateData[indexUpdate], ...action.chart };
      } else {
        updateData.push(action.chart);
      }
      return { ...state, loading: false, data: updateData };
    case FETCH_CHART_FAIL:
      if (action.chartId) {
        const newData = [...state.data];
        let indexFound = false;
        for (let i = 0; i < state.data.length; i++) {
          if (state.data[i].id === parseInt(action.chartId, 10)) {
            indexFound = i;
          }
        }

        if (indexFound) newData[indexFound].loading = false;

        return { ...state, data: newData, loading: false };
      }

      return { ...state, loading: false, error: true };
    default:
      return state;
  }
}
