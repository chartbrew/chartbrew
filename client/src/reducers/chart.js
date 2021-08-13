import {
  FETCH_CHART,
  FETCH_CHART_FAIL,
  FETCH_CHART_SUCCESS,
  FETCH_ALL_CHARTS,
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

        return { ...state, data: newData };
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
        newData[indexFound] = action.chart;
      } else {
        newData.push(action.chart);
      }
      return { ...state, loading: false, data: newData };
    case FETCH_CHART_FAIL:
      return { ...state, loading: false, error: true };
    default:
      return state;
  }
}
