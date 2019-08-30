import {
  ADD_TEAM,
  SAVE_ACTIVE_TEAM,
  SAVE_TEAM_LIST,
  CREATING_TEAM_SUCCESS,
  CREATING_TEAM_FAILED,
  SAVE_TEAM_MEMBERS,
  UPDATE_TEAM_MEMBER_ROLE,
} from "../actions/team";

export default function team(state = {
  loading: false,
  error: false,
  isTeamOwner: false,
  data: [],
  active: {},
  newTeam: {},
  teamMembers: [],
}, action) {
  switch (action.type) {
    case ADD_TEAM:
      return { ...state, data: [...state.data, action.addTeam] };
    case SAVE_ACTIVE_TEAM:
      return { ...state, active: action.activeTeam };
    case SAVE_TEAM_LIST:
      return { ...state, loading: false, data: action.teamList };
    case CREATING_TEAM_SUCCESS:
      return { ...state, loading: false, newTeam: action.team };
    case CREATING_TEAM_FAILED:
      return { ...state, loading: false, error: true };
    case SAVE_TEAM_MEMBERS:
      return { ...state, teamMembers: action.saveMembers };
    case UPDATE_TEAM_MEMBER_ROLE:
      const updatedMembers = [...state.teamMembers];
      if (updatedMembers) {
        for (let i = 0; i < state.teamMembers.length; i++) {
          if (state.teamMembers[i].id === action.updatedRole.user_id) {
            updatedMembers[i].TeamRoles[0].role = action.updatedRole.role;
            break;
          }
        }
      }
      return { ...state, teamMembers: updatedMembers };
    default:
      return state;
  }
}
