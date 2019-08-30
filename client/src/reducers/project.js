import {
  FETCHING_PROJECT,
  FETCHING_PROJECT_FAILED,
  FETCHING_PROJECT_SUCCESS,
  FETCHING_ALL_PROJECTS,
  CHANGE_ACTIVE_PROJECT,
} from "../actions/project";

import {
  FETCHING_CONNECTION,
} from "../actions/connection";

export default function project(state = {
  loading: false,
  error: false,
  active: {},
  data: [],
}, action) {
  switch (action.type) {
    case FETCHING_PROJECT:
    case FETCHING_CONNECTION:
      return { ...state, loading: true };
    case FETCHING_ALL_PROJECTS:
      return { ...state, loading: false, data: action.projects };
    case FETCHING_PROJECT_SUCCESS:
      // look for existing project in the data array and replace it if it exists
      let indexFound = -1;
      for (let i = 0; i < state.data.length; i++) {
        if (state.data[i].id === parseInt(action.project.id, 10)) {
          indexFound = i;
          break;
        }
      }
      const newData = [...state.data];
      if (indexFound > -1) {
        newData[indexFound] = action.project;
      } else {
        newData.push(action.project);
      }
      return { ...state, loading: false, data: newData };
    case FETCHING_PROJECT_FAILED:
      return { ...state, loading: false, error: true };
    case CHANGE_ACTIVE_PROJECT:
      // find the project by id
      let selectedProject = {};
      for (let i = 0; i < state.data.length; i++) {
        if (state.data[i] && state.data[i].id === parseInt(action.id, 10)) {
          selectedProject = state.data[i];
          break;
        }
      }
      return { ...state, active: selectedProject };
    default:
      return state;
  }
}
