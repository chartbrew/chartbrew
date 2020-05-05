import {
  FETCHING_DATASET,
  FETCH_DATASET_FAIL,
  FETCH_CHART_DATASETS,
  FETCH_DATASET_SUCCESS,
} from "../actions/dataset";

export default function dataset(state = {
  loading: false,
  error: false,
  data: [],
}, action) {
  switch (action.type) {
    case FETCHING_DATASET:
      return { ...state, loading: true };
    case FETCH_CHART_DATASETS:
      return { ...state, loading: false, data: action.datasets };
    case FETCH_DATASET_SUCCESS:
      // look for existing datasets in the data array and replace it if it exists
      let indexFound = -1;
      for (let i = 0; i < state.data.length; i++) {
        if (state.data[i].id === parseInt(action.dataset.id, 10)) {
          indexFound = i;
          break;
        }
      }
      const newData = [...state.data];
      if (indexFound > -1) {
        newData[indexFound] = action.dataset;
      } else {
        newData.push(action.dataset);
      }
      return { ...state, loading: false, data: newData };
    case FETCH_DATASET_FAIL:
      return { ...state, loading: false, error: true };
    default:
      return state;
  }
}
